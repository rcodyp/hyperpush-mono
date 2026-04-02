use std::path::{Path, PathBuf};
use std::process::{Command, Output};

pub fn meshc_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_meshc"))
}

pub fn command_output_text(output: &Output) -> String {
    format!(
        "status: {:?}\nstdout:\n{}\nstderr:\n{}",
        output.status.code(),
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}

pub fn run_meshc_init(current_dir: &Path, args: &[&str]) -> Output {
    Command::new(meshc_bin())
        .current_dir(current_dir)
        .args(args)
        .output()
        .unwrap_or_else(|error| {
            panic!(
                "failed to run meshc init in {} with args {:?}: {error}",
                current_dir.display(),
                args
            )
        })
}
