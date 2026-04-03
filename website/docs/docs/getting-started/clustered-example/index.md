---
title: Clustered Example
description: Start the generated clustered scaffold, inspect runtime-owned startup work through the CLI, and learn the same route-free contract shared by the scaffold, tiny-cluster, and cluster-proof.
---

# Clustered Example

Mesh exposes one route-free clustered-work contract through three equal canonical surfaces:

- `meshc init --clustered` for the scaffold-first app story
- [`tiny-cluster/README.md`](https://github.com/snowdamiz/mesh-lang/blob/main/tiny-cluster/README.md) for the smallest repo-owned proof package
- [`cluster-proof/README.md`](https://github.com/snowdamiz/mesh-lang/blob/main/cluster-proof/README.md) for the packaged failover-oriented dogfood runbook

This page teaches the scaffold surface, but the runtime contract stays the same on all three:

- `mesh.toml` stays package-only
- `work.mpl` owns the single `@cluster` declaration in source
- `main.mpl` boots only through `Node.start_from_env()`
- the runtime automatically starts declared work at startup
- operators inspect truth only through `meshc cluster status`, continuity list, continuity record, and diagnostics

If you are migrating older clustered code, move `clustered(work)` into source-first `@cluster`, delete any `[cluster]` manifest stanza, and rename helper-shaped entries such as `execute_declared_work(...)` / `Work.execute_declared_work` to ordinary verbs like `add()` or `sync_todos()`. Keep the route-free `@cluster` surfaces canonical: the PostgreSQL Todo starter only dogfoods explicit-count `HTTP.clustered(1, ...)` on `GET /todos` and `GET /todos/:id`, while `GET /health` and mutating routes stay local. Default-count and two-node clustered-route behavior stay on the repo S07 rail (`cargo test -p meshc --test e2e_m047_s07 -- --nocapture`).

When you want the honest local starter, use `meshc init --template todo-api --db sqlite`. It is the single-node SQLite Todo API with generated package tests, local `/health`, and no `work.mpl`, `HTTP.clustered(...)`, or `meshc cluster` story.

When you want a fuller shared or deployable starter without changing that contract, use `meshc init --template todo-api --db postgres`. It keeps `@cluster pub fn sync_todos()` route-free in `work.mpl` while the selected read routes dogfood explicit-count `HTTP.clustered(1, ...)` and the rest of the HTTP surface stays local application code.

## Generate the scaffold

```bash
meshc init --clustered hello_cluster
cd hello_cluster
```

The generated project is intentionally small:

```text
hello_cluster/
  mesh.toml
  main.mpl
  work.mpl
  README.md
```

## Understand the generated files

### `mesh.toml`

The clustered scaffold keeps the manifest package-only:

```toml
[package]
name = "hello_cluster"
version = "0.1.0"

[dependencies]
```

Clustered work is declared in source, not in the manifest.

### `main.mpl`

The generated app does not hand-roll clustering logic. It only logs runtime bootstrap success or failure:

```mesh
fn main() do
  case Node.start_from_env() do
    Ok(status) -> log_bootstrap(status)
    Err(reason) -> log_bootstrap_failure(reason)
  end
end
```

That keeps startup, placement, continuity ownership, and diagnostics inside the runtime.

### `work.mpl`

The clustered work contract lives in source:

```mesh
@cluster pub fn add() -> Int do
  1 + 1
end
```

The visible work body stays intentionally plain. The runtime automatically starts the source-declared `@cluster` handler and closes the continuity record when the declared work returns. If you are upgrading from older clustered code, replace `clustered(work)` plus helper-shaped names such as `execute_declared_work(...)` / `Work.execute_declared_work` with an ordinary `@cluster` function here and remove any matching `[cluster]` manifest stanza.

## Build the example

```bash
meshc build .
```

That produces `./hello_cluster` in the project root.

## Run two local nodes

The generated `README.md` lists the full environment contract. For a local two-node demo, start one primary and one standby with the same cookie and discovery seed.

### Terminal 1 — primary

```bash
MESH_CLUSTER_COOKIE=dev-cookie \
MESH_NODE_NAME=primary@127.0.0.1:4370 \
MESH_DISCOVERY_SEED=localhost \
MESH_CLUSTER_PORT=4370 \
MESH_CONTINUITY_ROLE=primary \
MESH_CONTINUITY_PROMOTION_EPOCH=0 \
./hello_cluster
```

### Terminal 2 — standby

```bash
MESH_CLUSTER_COOKIE=dev-cookie \
MESH_NODE_NAME='standby@[::1]:4370' \
MESH_DISCOVERY_SEED=localhost \
MESH_CLUSTER_PORT=4370 \
MESH_CONTINUITY_ROLE=standby \
MESH_CONTINUITY_PROMOTION_EPOCH=0 \
./hello_cluster
```

Both terminals should log a runtime bootstrap line showing the resolved node name, cluster port, and discovery seed.

## Inspect cluster truth with the runtime CLI

Automatic startup work means you already have continuity state to inspect once the nodes finish booting. Follow the same operator order used by the scaffold README, `tiny-cluster/`, and `cluster-proof/`.

### 1. Status

```bash
meshc cluster status primary@127.0.0.1:4370 --json
meshc cluster status 'standby@[::1]:4370' --json
```

Look for both nodes in membership plus runtime-owned authority fields such as `cluster_role`, `promotion_epoch`, and `replication_health`.

### 2. Continuity list

```bash
meshc cluster continuity primary@127.0.0.1:4370 --json
meshc cluster continuity 'standby@[::1]:4370' --json
```

Use the list form first to discover request keys and runtime-owned startup records.

### 3. Continuity record

Once the list output shows a request key you care about, inspect that single record:

```bash
meshc cluster continuity primary@127.0.0.1:4370 <request-key> --json
meshc cluster continuity 'standby@[::1]:4370' <request-key> --json
```

This gives the per-record continuity detail for the same runtime-owned work item.

### 4. Diagnostics

```bash
meshc cluster diagnostics primary@127.0.0.1:4370 --json
```

Use diagnostics when you need the broader cluster view after checking membership and continuity.

## Equal-surface follow-ons

Use the three canonical route-free surfaces interchangeably depending on the scope you need, then choose the Todo starter that matches the contract you actually want:

- stay on this page when you want the public scaffold-first story
- use `meshc init --template todo-api --db sqlite <name>` when you want the honest local single-node starter with generated package tests and no clustered/operator claim
- use `meshc init --template todo-api --db postgres <name>` when you want the fuller shared/deployable starter with route-free `work.mpl`, PostgreSQL-backed state, and explicit-count `HTTP.clustered(1, ...)` on the selected read routes while keeping the same source-first `@cluster` contract
- use [`tiny-cluster/README.md`](https://github.com/snowdamiz/mesh-lang/blob/main/tiny-cluster/README.md) when you want the smallest repo-owned package that still proves the route-free contract
- use [`cluster-proof/README.md`](https://github.com/snowdamiz/mesh-lang/blob/main/cluster-proof/README.md) when you want the deeper packaged failover/operator runbook
- use [Distributed Proof](/docs/distributed-proof/) when you want the repo verifier map; `bash scripts/verify-m047-s04.sh` remains the authoritative cutover rail for the source-first route-free clustered contract, `bash scripts/verify-m047-s05.sh` is the retained historical clustered Todo subrail kept behind fixture-backed rails instead of the public starter contract, `cargo test -p meshc --test e2e_m047_s07 -- --nocapture` remains the repo S07 rail for default-count and two-node wrapper behavior beyond the PostgreSQL Todo starter's explicit-count read routes, and `bash scripts/verify-m047-s06.sh` is the docs and retained-proof closeout rail that wraps S05, rebuilds docs truth, and owns the assembled `.tmp/m047-s06/verify` bundle. `bash scripts/verify-m046-s06.sh`, `bash scripts/verify-m046-s05.sh`, `bash scripts/verify-m046-s04.sh`, `bash scripts/verify-m045-s05.sh`, and `bash scripts/verify-m045-s04.sh` remain historical compatibility aliases into the M047 cutover rail, while `bash scripts/verify-m045-s03.sh` remains the historical failover-specific subrail

## What to read next

- [Getting Started](/docs/getting-started/) — the single-binary introduction and hello-world path
- [Developer Tools](/docs/tooling/) — scaffold generation, inspection CLI commands, and editor support
- [Distributed Actors](/docs/distributed/) — the language/runtime primitives behind node communication
- [Distributed Proof](/docs/distributed-proof/) — the verifier map for the scaffold, `tiny-cluster`, and `cluster-proof` surfaces
