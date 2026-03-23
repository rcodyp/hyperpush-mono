use std::io::{Read as _, Write as _};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

fn find_meshc() -> PathBuf {
    let mut path = std::env::current_exe()
        .expect("cannot find current exe")
        .parent()
        .expect("cannot find parent dir")
        .to_path_buf();

    if path.file_name().map_or(false, |n| n == "deps") {
        path = path.parent().unwrap().to_path_buf();
    }

    let meshc = path.join("meshc");
    assert!(
        meshc.exists(),
        "meshc binary not found at {}. Run `cargo build -p meshc` first.",
        meshc.display()
    );
    meshc
}

fn build_reference_backend() -> Output {
    let root = repo_root();
    let meshc = find_meshc();
    Command::new(&meshc)
        .current_dir(&root)
        .args(["build", "reference-backend"])
        .output()
        .expect("failed to invoke meshc build for reference-backend")
}

fn reference_backend_binary() -> PathBuf {
    repo_root().join("reference-backend").join("reference-backend")
}

#[test]
fn e2e_reference_backend_builds() {
    let output = build_reference_backend();
    assert!(
        output.status.success(),
        "meshc build reference-backend failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    let binary = reference_backend_binary();
    assert!(
        binary.exists(),
        "compiled reference-backend binary not found at {}",
        binary.display()
    );
}

#[test]
#[ignore]
fn e2e_reference_backend_postgres_smoke() {
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set for e2e_reference_backend_postgres_smoke");

    let build_output = build_reference_backend();
    assert!(
        build_output.status.success(),
        "meshc build reference-backend failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&build_output.stdout),
        String::from_utf8_lossy(&build_output.stderr)
    );

    let binary = reference_backend_binary();
    let mut child = Command::new(&binary)
        .current_dir(repo_root())
        .env("DATABASE_URL", database_url)
        .env("PORT", "18080")
        .env("JOB_POLL_MS", "1000")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap_or_else(|e| panic!("failed to spawn {}: {}", binary.display(), e));

    let mut response = String::new();
    let mut connected = false;
    for attempt in 0..20 {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(250));
        }

        match std::net::TcpStream::connect("127.0.0.1:18080") {
            Ok(mut stream) => {
                stream
                    .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                    .unwrap();
                stream
                    .write_all(
                        b"GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
                    )
                    .expect("failed to write HTTP request");
                stream
                    .read_to_string(&mut response)
                    .expect("failed to read HTTP response");
                connected = true;
                break;
            }
            Err(_) => continue,
        }
    }

    let _ = child.kill();
    let output = child
        .wait_with_output()
        .expect("failed to collect reference-backend output");

    assert!(
        connected,
        "reference-backend never became reachable on :18080\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        response.contains("200"),
        "expected HTTP 200 from /health, got: {}\nstdout: {}\nstderr: {}",
        response,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        response.contains(r#"{"status":"ok"}"#),
        "expected JSON health payload, got: {}\nstdout: {}\nstderr: {}",
        response,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}
