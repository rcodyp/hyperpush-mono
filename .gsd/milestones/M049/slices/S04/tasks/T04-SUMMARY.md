---
id: T04
parent: S04
milestone: M049
provides:
  - Retargeted the retained clustered Rust rails and verifier scripts to the relocated clustered fixtures, and updated the M047 contract target to assert the scaffold/examples-first public story.
key_files:
  - compiler/meshc/tests/e2e_m045_s01.rs
  - compiler/meshc/tests/e2e_m046_s05.rs
  - compiler/meshc/tests/e2e_m047_s04.rs
  - scripts/verify-m047-s04.sh
  - compiler/meshc/tests/e2e_m039_s01.rs
  - scripts/verify-m039-s01.sh
  - scripts/verify-m045-s02.sh
  - scripts/fixtures/clustered/tiny-cluster/work.mpl
key_decisions:
  - Kept the historical M039 verifier phase names (`convergence`, `node-loss`) but moved the proof transport to route-free `meshc cluster status` against the relocated `cluster-proof` fixture instead of reviving the deleted `/membership` HTTP app.
patterns_established:
  - Public clustered contract tests now separate public onboarding surfaces (scaffold plus generated examples) from lower-level retained fixture readmes under `scripts/fixtures/clustered/`.
observability_surfaces:
  - .tmp/m039-s01/verify, .tmp/m045-s01/*, .tmp/m046-s05/*, .tmp/m047-s04/*, and the failing .tmp/m045-s02/verify/03-m044-s02-declared-work.log rail
duration: partial checkpoint before final slice gate
verification_result: failed
completed_at: 2026-04-02 23:23:39 EDT
blocker_discovered: false
---

# T04: Retarget retained Rust contract rails to the internal clustered fixtures

**Retargeted the retained Rust clustered rails to the relocated fixtures and scaffold/examples-first public story, but the final slice gate still fails in the older M044 declared-work verifier.**

## What Happened

I updated the direct Rust consumers that still assumed repo-root `tiny-cluster/` and `cluster-proof/` packages. `e2e_m045_s01` now reads and builds the relocated `scripts/fixtures/clustered/cluster-proof` package, `e2e_m046_s05` compares scaffold output against the relocated fixture roots instead of deleted repo-root paths, and `e2e_m047_s04` now treats `examples/todo-postgres/README.md` and `examples/todo-sqlite/README.md` as the public clustered onboarding surfaces while keeping the relocated fixture readmes as lower-level retained proof surfaces.

I also updated `scripts/verify-m047-s04.sh` so its contract guards and smoke commands match the moved fixture layout and the scaffold/examples-first public story. While replaying the slice-level verifiers, I found two additional stale seams outside the original task file list: `scripts/verify-m039-s01.sh` / `scripts/verify-m045-s02.sh` still called `meshc build cluster-proof` / `meshc test cluster-proof/tests`, and the old `e2e_m039_s01` harness still targeted the deleted routeful `/membership` proof app. I repaired the path assumptions in the shell verifiers, removed the stale comment drift from `scripts/fixtures/clustered/tiny-cluster/work.mpl`, and rewrote `e2e_m039_s01` to prove convergence and node-loss through `meshc cluster status` on the relocated route-free fixture while preserving the historical phase names that downstream verifiers expect.

That got the M039 slice-level gate green again. The remaining failure is the second slice-level verifier: `bash scripts/verify-m045-s02.sh` now gets past the relocated fixture build/test steps, but it still fails in the older `m044_s02_declared_work_llvm_registers_manifest_declared_handler_only` rail because that temp-project test still emits an unsupported `[cluster]` manifest stanza and the parser rejects it before the declared-work assertions run.

## Verification

Task-level verification passed after the Rust rails and M047 verifier were retargeted:
- `cargo test -p meshc --test e2e_m045_s01 -- --nocapture`
- `cargo test -p meshc --test e2e_m045_s02 -- --nocapture`
- `cargo test -p meshc --test e2e_m046_s05 -- --nocapture`
- `cargo test -p meshc --test e2e_m047_s04 -- --nocapture`

Slice-level verification was partially replayed:
- `bash scripts/verify-m039-s01.sh` now passes against the relocated route-free fixture.
- `bash scripts/verify-m045-s02.sh` still fails, but the failure is now localized to the older M044 declared-work verifier rather than the deleted root fixture paths.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cargo test -p meshc --test e2e_m045_s01 -- --nocapture` | 0 | ✅ pass | 19.5s |
| 2 | `cargo test -p meshc --test e2e_m045_s02 -- --nocapture` | 0 | ✅ pass | 16.0s |
| 3 | `cargo test -p meshc --test e2e_m046_s05 -- --nocapture` | 0 | ✅ pass | 15.7s |
| 4 | `cargo test -p meshc --test e2e_m047_s04 -- --nocapture` | 0 | ✅ pass | 10.7s |
| 5 | `bash scripts/verify-m039-s01.sh` | 0 | ✅ pass | 92.0s |
| 6 | `bash scripts/verify-m045-s02.sh` | 1 | ❌ fail | 150.6s |

## Diagnostics

Inspect the retained artifacts under these directories:
- `.tmp/m039-s01/verify/` — historical M039 convergence/node-loss rail, now using `meshc cluster status`
- `.tmp/m045-s01/` — relocated cluster-proof source/build contract replay
- `.tmp/m046-s05/` — scaffold vs relocated fixture equal-surface replay
- `.tmp/m047-s04/` — public docs/examples/fixture contract replay
- `.tmp/m045-s02/verify/03-m044-s02-declared-work.log` — current failing slice gate; this is the concrete resume seam

The failing log shows the older declared-work rail now stops at:
`error: Failed to parse .../mesh.toml: [cluster] manifest sections are no longer supported; move clustered declarations into source with @cluster or @cluster(N)`

## Deviations

I had to repair two additional historical verifier seams that were not listed in the original task plan but were required by the final slice-level gate: `scripts/verify-m039-s01.sh` / `scripts/verify-m045-s02.sh` still used deleted root fixture paths, and `compiler/meshc/tests/e2e_m039_s01.rs` still assumed the deleted routeful `/membership` proof app.

## Known Issues

- `bash scripts/verify-m045-s02.sh` still fails at `cargo test -p meshc --test e2e_m044_s02 m044_s02_declared_work_ -- --nocapture`.
- The failing `m044_s02_declared_work_llvm_registers_manifest_declared_handler_only` rail still materializes a temp `mesh.toml` with an unsupported `[cluster]` section. Resume in `compiler/meshc/tests/e2e_m044_s02.rs` and the temp-project fixture it writes; the retained failure log is `.tmp/m045-s02/verify/03-m044-s02-declared-work.log`.
- Because the final slice-level gate is still red, I did **not** mark T04 complete or touch plan checkboxes.

## Files Created/Modified

- `compiler/meshc/tests/e2e_m045_s01.rs` — retargeted the retained cluster-proof contract rail to the relocated fixture and updated stale helper-shaped work-name assertions.
- `compiler/meshc/tests/e2e_m046_s05.rs` — switched equal-surface work-file comparisons to the relocated fixture roots.
- `compiler/meshc/tests/e2e_m047_s04.rs` — rewrote the authoritative cutover contract target around the scaffold/examples-first public story plus lower-level relocated fixture readmes.
- `scripts/verify-m047-s04.sh` — updated the public contract guards and fixture smoke commands to the relocated paths.
- `scripts/fixtures/clustered/tiny-cluster/work.mpl` — removed the stale leading comment so the fixture matches the generated scaffold and relocated cluster-proof work file byte-for-byte.
- `compiler/meshc/tests/e2e_m039_s01.rs` — replaced the deleted routeful `/membership` harness with a route-free `meshc cluster status` convergence/node-loss proof against the relocated fixture.
- `scripts/verify-m039-s01.sh` — pointed the historical M039 build replay at `scripts/fixtures/clustered/cluster-proof`.
- `scripts/verify-m045-s02.sh` — pointed the retained cluster-proof build/test replay at the relocated fixture paths before the downstream M044 declared-work rail runs.
