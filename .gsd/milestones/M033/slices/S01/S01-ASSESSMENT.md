# S01 closer wrap-up — incomplete slice closeout

## Status
Slice S01 is **not ready for closeout**. I hit the context-budget stop while wiring the neutral expression surface through compiler/codegen and starting the Mesher write-path rewrites. I did **not** run the slice verification bundle and I did **not** call `gsd_slice_complete`.

## Durable work landed this unit

### Compiler / runtime wiring started
- `compiler/mesh-typeck/src/infer.rs`
  - added an `Expr` stdlib module surface for `column`, `value`, `null`, `call`, arithmetic/comparison helpers, `case`, `coalesce`, `excluded`, and `alias`
  - added `Repo.update_where_expr(...)` and `Repo.insert_or_update_expr(...)` type signatures
  - added `Expr` to `STDLIB_MODULE_NAMES`
- `compiler/mesh-codegen/src/mir/lower.rs`
  - registered `mesh_expr_*` known functions
  - registered `mesh_repo_update_where_expr` and `mesh_repo_insert_or_update_expr`
  - added builtin-name mappings for `expr_*`, `repo_update_where_expr`, and `repo_insert_or_update_expr`
- `compiler/mesh-codegen/src/codegen/intrinsics.rs`
  - declared LLVM externs for `mesh_expr_*`, `mesh_repo_update_where_expr`, and `mesh_repo_insert_or_update_expr`
  - extended intrinsic presence assertions for those symbols

### Mesher write-path rewrites started
- `mesher/storage/queries.mpl`
  - rewrote `revoke_api_key(...)` to use `Repo.update_where_expr(..., %{"revoked_at" => Expr.call("now", [])}, ...)`
  - rewrote `upsert_issue(...)` to use `Repo.insert_or_update_expr(...)` with expression-valued `event_count`, `last_seen`, and `status`

## Important current state
This is a **partial** implementation state. The following planned S01 work is still missing or unverified:
- no `compiler/meshc/tests/e2e_m033_s01.rs`
- no `scripts/verify-m033-s01.sh`
- no slice-level verification rerun
- no proof yet that the new typechecker/codegen wiring actually compiles Mesh code end-to-end
- `assign_issue`, `acknowledge_alert`, `resolve_fired_alert`, and `update_project_settings` in `mesher/storage/queries.mpl` are still on their old implementations
- requirement status was **not** updated because there is no passing evidence bundle yet
- `DECISIONS.md`, `KNOWLEDGE.md`, and `PROJECT.md` were **not** updated in this interrupted unit

## Highest-value resume order
1. **Build/test the compiler surface first**
   - `cargo test -p meshc --test e2e -- --nocapture` is too broad; start narrower with the runtime/compiler crates or a targeted `cargo test -p mesh-rt` / `cargo test -p meshc` check to catch symbol/signature mismatches from the new `Expr` and Repo-expression hooks.
   - Expect the most likely drift in `compiler/mesh-codegen/src/codegen/intrinsics.rs` because this file already had existing ORM declaration blocks; I removed one duplicate block during this unit, but this is the first place to inspect if declarations/assertions drift.
2. **Finish the remaining Mesher rewrites in `mesher/storage/queries.mpl`**
   - `assign_issue`
   - `acknowledge_alert`
   - `resolve_fired_alert`
   - `update_project_settings`
3. **Create the missing proof artifacts**
   - `compiler/meshc/tests/e2e_m033_s01.rs`
   - `scripts/verify-m033-s01.sh`
4. **Only after those exist, run the slice bundle from the plan**
   - `cargo test -p meshc --test e2e_m033_s01 -- --nocapture`
   - `cargo test -p meshc --test e2e_m033_s01 expr_error_ -- --nocapture`
   - `cargo run -q -p meshc -- fmt --check mesher`
   - `cargo run -q -p meshc -- build mesher`
   - `bash scripts/verify-m033-s01.sh`
5. If the full bundle passes, then update requirement evidence and perform the real slice closeout with `gsd_slice_complete`.

## Resume cautions
- Do **not** trust the current task checkboxes in `S01-PLAN.md` as evidence of completion; prior interrupted units already marked tasks done on disk while leaving the slice unproven.
- The absence of language servers in this environment means semantic verification is unavailable; expect to rely on direct compile/test feedback.
- Keep the S01 boundary honest: JSONB-heavy write paths (`create_alert_rule`, `fire_alert`, `insert_event`) still belong to S02.
