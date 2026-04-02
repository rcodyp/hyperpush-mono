mod support;

use std::fs;
use support::m049_todo_postgres_scaffold as todo;

#[test]
fn m049_s01_db_requires_todo_api_template() {
    let dir = tempfile::tempdir().unwrap();
    let project_dir = dir.path().join("plain-project");

    let output = todo::run_meshc_init(dir.path(), &["init", "--db", "sqlite", "plain-project"]);

    assert!(
        !output.status.success(),
        "meshc init --db sqlite without --template todo-api should fail:\n{}",
        todo::command_output_text(&output)
    );

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("`--db` is only supported"), "{}", stderr);
    assert!(stderr.contains("--template todo-api"), "{}", stderr);
    assert!(
        !project_dir.exists(),
        "unexpected project created at {}",
        project_dir.display()
    );
}

#[test]
fn m049_s01_clustered_todo_db_conflict_fails_before_generation() {
    let dir = tempfile::tempdir().unwrap();
    let project_dir = dir.path().join("todo-starter");

    let output = todo::run_meshc_init(
        dir.path(),
        &[
            "init",
            "--clustered",
            "--template",
            "todo-api",
            "--db",
            "sqlite",
            "todo-starter",
        ],
    );

    assert!(
        !output.status.success(),
        "clustered todo-api db conflict should fail closed:\n{}",
        todo::command_output_text(&output)
    );

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("`meshc init --clustered` cannot be combined"),
        "{}",
        stderr
    );
    assert!(stderr.contains("--template todo-api"), "{}", stderr);
    assert!(
        !project_dir.exists(),
        "unexpected project created at {}",
        project_dir.display()
    );
}

#[test]
fn m049_s01_sqlite_db_flag_keeps_current_todo_starter_contract() {
    let dir = tempfile::tempdir().unwrap();
    let project_dir = dir.path().join("todo-starter");

    let output = todo::run_meshc_init(
        dir.path(),
        &[
            "init",
            "--template",
            "todo-api",
            "--db",
            "sqlite",
            "todo-starter",
        ],
    );

    assert!(
        output.status.success(),
        "meshc init --template todo-api --db sqlite should keep the current starter green:\n{}",
        todo::command_output_text(&output)
    );

    let main = fs::read_to_string(project_dir.join("main.mpl")).unwrap();
    let storage = fs::read_to_string(project_dir.join("storage/todos.mpl")).unwrap();
    let readme = fs::read_to_string(project_dir.join("README.md")).unwrap();

    assert!(main.contains("TODO_DB_PATH"));
    assert!(main.contains("ensure_schema"));
    assert!(storage.contains("Sqlite.open"));
    assert!(storage.contains("CREATE TABLE IF NOT EXISTS todos"));
    assert!(readme.contains("TODO_DB_PATH"));
}

#[test]
fn m049_s01_postgres_db_path_fails_closed_before_generation() {
    let dir = tempfile::tempdir().unwrap();
    let project_dir = dir.path().join("todo-starter");

    let output = todo::run_meshc_init(
        dir.path(),
        &[
            "init",
            "--template",
            "todo-api",
            "--db",
            "postgres",
            "todo-starter",
        ],
    );

    assert!(
        !output.status.success(),
        "postgres todo-api path should fail closed until the dedicated scaffold lands:\n{}",
        todo::command_output_text(&output)
    );

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("--db postgres"), "{}", stderr);
    assert!(stderr.contains("not implemented yet"), "{}", stderr);
    assert!(
        !project_dir.exists(),
        "postgres failure path should not create {}",
        project_dir.display()
    );
}
