mod support;

use std::path::{Path, PathBuf};
use support::m046_route_free as route_free;

const MIGRATION_GUIDANCE: &str = "If you are migrating older clustered code, move `clustered(work)` into source-first `@cluster`, delete any `[cluster]` manifest stanza, and rename helper-shaped entries such as `execute_declared_work(...)` / `Work.execute_declared_work` to ordinary verbs like `add()` or `sync_todos()`.";
const SQLITE_STARTER_COMMAND: &str = "meshc init --template todo-api --db sqlite";
const POSTGRES_STARTER_COMMAND: &str = "meshc init --template todo-api --db postgres";
const SQLITE_LOCAL_GUIDANCE: &str = "The SQLite Todo starter is the honest local starter: a single-node SQLite Todo API";
const SQLITE_LOCAL_PATH_GUIDANCE: &str = "The SQLite Todo starter is the honest local path: single-node SQLite, generated package tests, and no `work.mpl`, `HTTP.clustered(...)`, or `meshc cluster` story";
const SQLITE_NOT_CLUSTERED_GUIDANCE: &str = "The SQLite Todo starter is intentionally local and is not a canonical clustered/operator proof surface.";
const POSTGRES_CLUSTERED_GUIDANCE: &str = "The PostgreSQL Todo starter keeps the clustered-function contract source-first and route-free";
const POSTGRES_WRAPPER_GUIDANCE: &str = "Keep the route-free `@cluster` surfaces canonical: the PostgreSQL Todo starter only dogfoods explicit-count `HTTP.clustered(1, ...)` on `GET /todos` and `GET /todos/:id`, while `GET /health` and mutating routes stay local.";
const S07_RAIL_GUIDANCE: &str = "Default-count and two-node clustered-route behavior stay on the repo S07 rail (`cargo test -p meshc --test e2e_m047_s07 -- --nocapture`).";
const STALE_CLUSTERED_NON_GOAL: &str = "`HTTP.clustered(...)` is still not shipped.";
const STALE_GENERIC_TODO_COMMAND: &str = "meshc init --template todo-api <name>";
const STALE_SQLITE_CLUSTERED_GUIDANCE: &str = "adding a SQLite HTTP app";
const STALE_SQLITE_CLUSTERED_ROUTES: &str = "local SQLite/HTTP routes plus explicit-count `HTTP.clustered(1, ...)`";
const CUTOVER_RAIL: &str = "`bash scripts/verify-m047-s04.sh` — the authoritative cutover rail for the source-first route-free clustered contract";
const TODO_SUBRAIL: &str = "`bash scripts/verify-m047-s05.sh` — the retained historical clustered Todo subrail kept behind fixture-backed rails instead of the public starter contract";
const CLOSEOUT_RAIL: &str = "`bash scripts/verify-m047-s06.sh` — the docs and retained-proof closeout rail that wraps S05, rebuilds docs truth, and owns the assembled `.tmp/m047-s06/verify` bundle";
const S07_RAIL_COMMAND: &str = "`cargo test -p meshc --test e2e_m047_s07 -- --nocapture`";

struct ContractSources {
    readme: String,
    tooling: String,
    clustered_example: String,
    distributed_proof: String,
    distributed: String,
    verifier: String,
}

fn repo_root() -> PathBuf {
    route_free::repo_root()
}

fn artifact_dir(test_name: &str) -> PathBuf {
    route_free::artifact_dir("m047-s06", test_name)
}

fn assert_contains(path_label: &str, source: &str, needle: &str) {
    assert!(
        source.contains(needle),
        "expected {path_label} to contain {needle:?}, got:\n{source}"
    );
}

fn assert_omits(path_label: &str, source: &str, needle: &str) {
    assert!(
        !source.contains(needle),
        "expected {path_label} to omit {needle:?}, got:\n{source}"
    );
}

fn assert_contains_all(path_label: &str, source: &str, needles: &[&str]) {
    for needle in needles {
        assert_contains(path_label, source, needle);
    }
}

fn assert_omits_all(path_label: &str, source: &str, needles: &[&str]) {
    for needle in needles {
        assert_omits(path_label, source, needle);
    }
}

fn load_contract_sources(artifacts: &Path) -> ContractSources {
    let contract_artifacts = artifacts.join("contract");
    ContractSources {
        readme: route_free::read_and_archive(
            &repo_root().join("README.md"),
            &contract_artifacts.join("README.md"),
        ),
        tooling: route_free::read_and_archive(
            &repo_root().join("website/docs/docs/tooling/index.md"),
            &contract_artifacts.join("tooling.index.md"),
        ),
        clustered_example: route_free::read_and_archive(
            &repo_root().join("website/docs/docs/getting-started/clustered-example/index.md"),
            &contract_artifacts.join("clustered-example.index.md"),
        ),
        distributed_proof: route_free::read_and_archive(
            &repo_root().join("website/docs/docs/distributed-proof/index.md"),
            &contract_artifacts.join("distributed-proof.index.md"),
        ),
        distributed: route_free::read_and_archive(
            &repo_root().join("website/docs/docs/distributed/index.md"),
            &contract_artifacts.join("distributed.index.md"),
        ),
        verifier: route_free::read_and_archive(
            &repo_root().join("scripts/verify-m047-s06.sh"),
            &contract_artifacts.join("verify-m047-s06.sh"),
        ),
    }
}

#[test]
fn m047_s06_public_docs_split_sqlite_local_from_postgres_clustered_starters() {
    let artifacts = artifact_dir("docs-authority-contract");
    let sources = load_contract_sources(&artifacts);

    for (path_label, source) in [
        ("README.md", &sources.readme),
        ("website/docs/docs/tooling/index.md", &sources.tooling),
        (
            "website/docs/docs/getting-started/clustered-example/index.md",
            &sources.clustered_example,
        ),
        (
            "website/docs/docs/distributed-proof/index.md",
            &sources.distributed_proof,
        ),
        (
            "website/docs/docs/distributed/index.md",
            &sources.distributed,
        ),
    ] {
        assert_contains(path_label, source, MIGRATION_GUIDANCE);
        assert_contains(path_label, source, POSTGRES_WRAPPER_GUIDANCE);
        assert_contains(path_label, source, S07_RAIL_GUIDANCE);
        assert_contains(path_label, source, SQLITE_STARTER_COMMAND);
        assert_contains(path_label, source, POSTGRES_STARTER_COMMAND);
        assert_omits(path_label, source, STALE_CLUSTERED_NON_GOAL);
        assert_omits_all(
            path_label,
            source,
            &[
                STALE_GENERIC_TODO_COMMAND,
                STALE_SQLITE_CLUSTERED_GUIDANCE,
                STALE_SQLITE_CLUSTERED_ROUTES,
            ],
        );
    }

    assert_contains(
        "README.md",
        &sources.readme,
        "meshc init --clustered hello_cluster",
    );
    assert_contains("README.md", &sources.readme, SQLITE_LOCAL_GUIDANCE);
    assert_contains(
        "README.md",
        &sources.readme,
        "The PostgreSQL Todo starter is the fuller shared/deployable app layered on top of that same contract.",
    );
    assert_contains(
        "README.md",
        &sources.readme,
        SQLITE_NOT_CLUSTERED_GUIDANCE,
    );
    assert_contains(
        "website/docs/docs/tooling/index.md",
        &sources.tooling,
        "If you want the honest local Todo starter, generate SQLite explicitly:",
    );
    assert_contains(
        "website/docs/docs/tooling/index.md",
        &sources.tooling,
        SQLITE_LOCAL_GUIDANCE,
    );
    assert_contains(
        "website/docs/docs/tooling/index.md",
        &sources.tooling,
        POSTGRES_CLUSTERED_GUIDANCE,
    );
    assert_contains(
        "website/docs/docs/getting-started/clustered-example/index.md",
        &sources.clustered_example,
        "When you want the honest local starter, use `meshc init --template todo-api --db sqlite`.",
    );
    assert_contains(
        "website/docs/docs/getting-started/clustered-example/index.md",
        &sources.clustered_example,
        "When you want a fuller shared or deployable starter without changing that contract, use `meshc init --template todo-api --db postgres`.",
    );
    assert_contains(
        "website/docs/docs/getting-started/clustered-example/index.md",
        &sources.clustered_example,
        "@cluster pub fn add() -> Int do",
    );
    assert_contains(
        "website/docs/docs/distributed-proof/index.md",
        &sources.distributed_proof,
        "Mesh exposes one clustered-work story through two public clustered layers, plus one intentionally local starter:",
    );
    assert_contains(
        "website/docs/docs/distributed-proof/index.md",
        &sources.distributed_proof,
        SQLITE_LOCAL_PATH_GUIDANCE,
    );
    assert_omits(
        "website/docs/docs/distributed-proof/index.md",
        &sources.distributed_proof,
        "package-authored claims that `HTTP.clustered(...)` already ships",
    );
    assert_contains(
        "website/docs/docs/distributed/index.md",
        &sources.distributed,
        "Use `meshc init --template todo-api --db postgres` when you want the fuller shared/deployable starter without changing that source-first `@cluster` contract, and treat `meshc init --template todo-api --db sqlite` as the honest local single-node starter instead of a clustered/operator proof surface.",
    );
}

#[test]
fn m047_s06_docs_layer_s04_s05_s06_and_s07_truthfully() {
    let artifacts = artifact_dir("rail-layering-contract");
    let sources = load_contract_sources(&artifacts);

    for (path_label, source) in [
        ("README.md", &sources.readme),
        (
            "website/docs/docs/distributed-proof/index.md",
            &sources.distributed_proof,
        ),
    ] {
        assert_contains_all(
            path_label,
            source,
            &[CUTOVER_RAIL, TODO_SUBRAIL, CLOSEOUT_RAIL, S07_RAIL_COMMAND],
        );
    }

    for (path_label, source) in [
        ("website/docs/docs/tooling/index.md", &sources.tooling),
        (
            "website/docs/docs/getting-started/clustered-example/index.md",
            &sources.clustered_example,
        ),
        (
            "website/docs/docs/distributed/index.md",
            &sources.distributed,
        ),
    ] {
        assert_contains(path_label, source, "bash scripts/verify-m047-s04.sh");
        assert_contains(
            path_label,
            source,
            "the authoritative cutover rail for the source-first route-free clustered contract",
        );
        assert_contains(
            path_label,
            source,
            "the retained historical clustered Todo subrail kept behind fixture-backed rails instead of the public starter contract",
        );
        assert_contains(
            path_label,
            source,
            "the docs and retained-proof closeout rail that wraps S05, rebuilds docs truth, and owns the assembled `.tmp/m047-s06/verify` bundle",
        );
        assert_contains(path_label, source, "bash scripts/verify-m047-s05.sh");
        assert_contains(path_label, source, "bash scripts/verify-m047-s06.sh");
        assert_contains(
            path_label,
            source,
            "cargo test -p meshc --test e2e_m047_s07 -- --nocapture",
        );
        assert_contains(
            path_label,
            source,
            "beyond the PostgreSQL Todo starter's explicit-count read routes",
        );
    }
}

#[test]
fn m047_s06_verifier_contract_wraps_s05_and_owns_retained_bundle() {
    let artifacts = artifact_dir("verifier-contract");
    let sources = load_contract_sources(&artifacts);
    let verifier = &sources.verifier;

    assert_contains_all(
        "scripts/verify-m047-s06.sh",
        verifier,
        &[
            "ARTIFACT_ROOT=\".tmp/m047-s06\"",
            "RETAINED_M047_S05_VERIFY_DIR=\"$ARTIFACT_DIR/retained-m047-s05-verify\"",
            "RETAINED_M047_S05_BUNDLE_POINTER_PATH=\"$ARTIFACT_DIR/retained-m047-s05-latest-proof-bundle.txt\"",
            "RETAINED_M047_S06_ARTIFACTS_DIR=\"$ARTIFACT_DIR/retained-m047-s06-artifacts\"",
            "RETAINED_PROOF_BUNDLE_DIR=\"$ARTIFACT_DIR/retained-proof-bundle\"",
            "bash scripts/verify-m047-s05.sh",
            "cargo test -p meshc --test e2e_m047_s06 m047_s06_ -- --nocapture",
            "npm --prefix website run build",
            "assert_file_omits_regex",
            "e2e_m047_s07",
            "HTTP\\.clustered\\(1, \\.\\.\\.\\)",
            "GET /health",
            "mutating routes stay local",
            "meshc init --template todo-api --db sqlite",
            "meshc init --template todo-api --db postgres",
            "single-node SQLite Todo API|honest local starter|honest local path",
            "PostgreSQL Todo starter|shared/deployable starter",
            "meshc init --template todo-api(?! --db (sqlite|postgres))",
            "adding a SQLite HTTP app|local SQLite/HTTP routes plus explicit-count `HTTP\\.clustered\\(1, \\.\\.\\.\\)`",
            "HTTP\\.clustered\\(\\.\\.\\.\\) is still not shipped",
            "HTTP\\.clustered\\(\\.\\.\\.\\).*already ships",
            "status.txt",
            "current-phase.txt",
            "phase-report.txt",
            "full-contract.log",
            "latest-proof-bundle.txt",
            "retained-m047-s05-verify",
            "retained-m047-s05-latest-proof-bundle.txt",
            "retained-m047-s06-artifacts",
            "retained-proof-bundle",
            "contract-guards",
            "m047-s05-replay",
            "retain-m047-s05-verify",
            "m047-s06-e2e",
            "m047-s06-docs-build",
            "m047-s06-artifacts",
            "m047-s06-bundle-shape",
            "verify-m047-s06: ok",
        ],
    );

    for delegated_phase in [
        "m047-s04-replay",
        "retain-m047-s04-verify",
        "m047-s05-pkg",
        "m047-s05-tooling",
        "m047-s05-e2e",
        "m047-s05-docs-build",
        "retain-m047-s05-artifacts",
        "m047-s05-bundle-shape",
    ] {
        assert_contains("scripts/verify-m047-s06.sh", verifier, delegated_phase);
    }

    assert_omits(
        "scripts/verify-m047-s06.sh",
        verifier,
        "ARTIFACT_ROOT=\".tmp/m047-s05\"",
    );
    assert_omits(
        "scripts/verify-m047-s06.sh",
        verifier,
        "bash scripts/verify-m047-s04.sh",
    );
    assert_omits(
        "scripts/verify-m047-s06.sh",
        verifier,
        "cargo test -p meshc --test e2e_m047_s05 -- --nocapture",
    );
    assert_omits(
        "scripts/verify-m047-s06.sh",
        verifier,
        "the explicit HTTP.clustered(...) non-goal",
    );
    assert_omits(
        "scripts/verify-m047-s06.sh",
        verifier,
        "HTTP\\.clustered\\(\\.\\.\\.\\).*not shipped",
    );
}
