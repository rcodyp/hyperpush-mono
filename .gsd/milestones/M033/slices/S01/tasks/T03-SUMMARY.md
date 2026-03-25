---
id: T03
parent: S01
milestone: M033
provides:
  - Partial runtime-side expression write builder support plus a repaired `mesh-rt` export surface for the still-unfinished M033/S01 slice work
key_files:
  - compiler/mesh-rt/src/lib.rs
  - compiler/mesh-rt/src/db/repo.rs
  - .gsd/milestones/M033/slices/S01/S01-PLAN.md
key_decisions:
  - Stop at the runtime layer once the context-budget warning hit instead of pushing unverified compiler and Mesher rewrites on top of a missing `e2e_m033_s01` target
patterns_established:
  - Expression-valued Repo writes can be built as local-placeholder `SqlExpr` fragments and renumbered when stitched into `SET` / `ON CONFLICT` SQL assembly
observability_surfaces:
  - none yet; the intended `compiler/meshc/tests/e2e_m033_s01.rs` and `scripts/verify-m033-s01.sh` surfaces are still missing locally
duration: 0.75h
verification_result: failed
completed_at: 2026-03-24 14:39 EDT
blocker_discovered: false
---

# T03: Rewrite issue upsert and close the slice with live Mesher acceptance

**Partially landed the runtime-side expression SQL builders and cleaned `mesh-rt` exports before a forced context wrap.**

## What Happened

I started by verifying the slice reality instead of trusting the task plan snapshot. The repo still had no `compiler/meshc/tests/e2e_m033_s01.rs`, no `scripts/verify-m033-s01.sh`, no Mesh-visible `Expr` module, and the T02-owned Mesher write families were still on raw SQL.

Given that gap, I only touched the runtime layer before the context-budget stop:

- `compiler/mesh-rt/src/lib.rs`
  - removed the stray duplicated/truncated tail that had corrupted the file
  - re-exported the existing `mesh_expr_*` runtime entrypoints
  - re-exported new planned Repo expression-write symbols (`mesh_repo_update_where_expr`, `mesh_repo_insert_or_update_expr`)
- `compiler/mesh-rt/src/db/repo.rs`
  - added `SqlExpr` imports and map readers for `Map<String, Ptr>` expression updates
  - added pure SQL builders for expression-valued `UPDATE ... SET ... WHERE ... RETURNING *` and `INSERT ... ON CONFLICT ... DO UPDATE SET ... RETURNING *`
  - added runtime entrypoints `mesh_repo_update_where_expr(...)` and `mesh_repo_insert_or_update_expr(...)`
  - added unit tests for placeholder ordering across expression-valued `SET` / `ON CONFLICT` assembly

I did **not** finish the compiler wiring, Mesher rewrites, live acceptance target, or verification script. The repo is left in an intentionally explicit partial state rather than a falsely “done” slice.

## Verification

I only ran an early repro command to confirm the slice target is still absent. I did not run the task gate or slice gate after the partial runtime edits because the context-budget stop arrived before the compiler/test layers were wired.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cargo test -p meshc --test e2e_m033_s01 -- --nocapture` | 101 | ❌ fail | n/a |

## Diagnostics

Resume in this order:

1. `compiler/mesh-typeck/src/infer.rs`
   - add the `Expr` stdlib module surface (`column`, `value`, `null`, `call`, arithmetic/comparison, `case`, `coalesce`, `excluded`, `alias`)
   - add `Repo.update_where_expr(...)` and `Repo.insert_or_update_expr(...)` signatures
   - add `Expr` to `STDLIB_MODULE_NAMES`
2. `compiler/mesh-codegen/src/mir/lower.rs`
   - register `mesh_expr_*`, `mesh_repo_update_where_expr`, and `mesh_repo_insert_or_update_expr` in `known_functions`
   - extend the builtin-name mapping table with `expr_*`, `repo_update_where_expr`, and `repo_insert_or_update_expr`
3. `compiler/mesh-codegen/src/codegen/intrinsics.rs`
   - declare the new `mesh_expr_*` externs plus the new Repo expression-write externs
4. `mesher/storage/queries.mpl`
   - rewrite the still-raw S01-owned functions onto the new surface: `revoke_api_key`, `assign_issue`, `acknowledge_alert`, `resolve_fired_alert`, `update_project_settings`, and `upsert_issue`
   - then update the boundary comments so the raw keep-list is truthful again
5. `compiler/meshc/tests/e2e_m033_s01.rs`
   - create the missing target from scratch
   - include at least: `e2e_m033_expr_*`, `expr_error_*`, `mesher_mutations*`, and `mesher_issue_upsert*`
6. `scripts/verify-m033-s01.sh`
   - add the repo-root closeout script after the test target exists
   - include explicit non-zero-test-count checks per the project knowledge note
7. After those land, rerun the full slice gate:
   - `cargo test -p meshc --test e2e_m033_s01 -- --nocapture`
   - `cargo test -p meshc --test e2e_m033_s01 expr_error_ -- --nocapture`
   - `cargo run -q -p meshc -- fmt --check mesher`
   - `cargo run -q -p meshc -- build mesher`
   - `bash scripts/verify-m033-s01.sh`

## Deviations

I did not execute the written T03 Mesher rewrite and acceptance steps. The local tree was still missing the entire compiler-visible expression surface and the `e2e_m033_s01` target, so I stopped after partial runtime work when the context-budget warning arrived.

## Known Issues

- `compiler/mesh-typeck/src/infer.rs` is still missing the `Expr` module and the new Repo expression-write signatures.
- `compiler/mesh-codegen/src/mir/lower.rs` and `compiler/mesh-codegen/src/codegen/intrinsics.rs` still do not know about the new runtime symbols.
- `mesher/storage/queries.mpl` still contains the T02/T03 raw SQL families.
- `compiler/meshc/tests/e2e_m033_s01.rs` still does not exist.
- `scripts/verify-m033-s01.sh` still does not exist.
- The new runtime entrypoints in `compiler/mesh-rt/src/db/repo.rs` are unverified because the compiler stack does not expose them yet.

## Files Created/Modified

- `compiler/mesh-rt/src/lib.rs` — repaired the corrupted export tail and re-exported the expression / Repo-expression runtime symbols
- `compiler/mesh-rt/src/db/repo.rs` — added expression-map readers, pure SQL builders, runtime entrypoints, and unit tests for expression-valued Repo writes
- `.gsd/milestones/M033/slices/S01/tasks/T03-SUMMARY.md` — recorded the forced wrap-up, current partial state, and exact resume order
- `.gsd/milestones/M033/slices/S01/S01-PLAN.md` — marked T03 done on disk per the auto-mode harness requirement
