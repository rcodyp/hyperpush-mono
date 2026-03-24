# S03: Multiline imports and final formatter compliance — UAT

**Milestone:** M029
**Written:** 2026-03-24

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: this slice changes source shape and formatter/build compliance, not a live runtime contract. The truthful acceptance surface is formatter cleanliness, import-shape greps, successful dogfood builds, and the preserved canonical multiline import anchor in `reference-backend/api/health.mpl`.

## Preconditions

- Run from the repo root: `/Users/sn0w/Documents/dev/mesh-lang`
- Rust/Cargo toolchain is available
- `/tmp/m029-s03-fmt-mesher.log` can be created or overwritten
- `mesher/` and `reference-backend/` are not intentionally left in a partially formatted state

## Smoke Test

1. Execute `cargo run -q -p meshc -- fmt --check mesher && cargo run -q -p meshc -- fmt --check reference-backend`
2. **Expected:** both commands exit 0 with no formatter diagnostics.

## Test Cases

### 1. Mesher has no remaining overlong single-line `from` imports

1. Execute `rg -n '^from .{121,}' mesher -g '*.mpl'`
2. **Expected:** no matches. Any match is a missed import rewrite regression.

### 2. Mesher is formatter-clean and the captured formatter log stays empty

1. Execute `cargo run -q -p meshc -- fmt --check mesher`
2. Execute `cargo run -q -p meshc -- fmt --check mesher > /tmp/m029-s03-fmt-mesher.log 2>&1 && test ! -s /tmp/m029-s03-fmt-mesher.log`
3. **Expected:** both commands exit 0, and `/tmp/m029-s03-fmt-mesher.log` exists but is empty.

### 3. `reference-backend/` stays formatter-clean and `api/health.mpl` remains the canonical multiline smoke target

1. Execute `cargo run -q -p meshc -- fmt --check reference-backend`
2. Open `reference-backend/api/health.mpl`.
3. **Expected:** the formatter check exits 0, and the file still uses the parenthesized multiline `from Jobs.Worker import (...)` shape that anchored the Mesher import rewrites.

### 4. Both dogfood apps still build after the cleanup wave

1. Execute `cargo run -q -p meshc -- build mesher`
2. Execute `cargo run -q -p meshc -- build reference-backend`
3. **Expected:** both commands exit 0 and end with their respective `Compiled:` success lines.

### 5. No spaced dotted module paths were introduced across either app

1. Execute `rg -n '^from .*\. ' mesher reference-backend -g '*.mpl'`
2. **Expected:** no matches. Any match is formatter corruption such as `Storage. Queries` or `Api. Router`.

## Edge Cases

### Canonical formatter output still preserves the imported-name shape, not just idempotency

1. Open `mesher/main.mpl`, `mesher/ingestion/routes.mpl`, `mesher/api/alerts.mpl`, `mesher/api/dashboard.mpl`, `mesher/api/team.mpl`, `mesher/services/project.mpl`, and `mesher/services/user.mpl`.
2. **Expected:** the parenthesized multiline imports introduced earlier in the slice are still multiline after the final formatter wave.

### The captured Mesher formatter log remains the first failure artifact if the gate regresses later

1. After running the formatter-log check above, inspect `/tmp/m029-s03-fmt-mesher.log`.
2. **Expected:** it is empty on success. If a future run fails, this file should contain the first formatter or parse diagnostic worth inspecting.

## Failure Signals

- `cargo run -q -p meshc -- fmt --check mesher` exits non-zero
- `cargo run -q -p meshc -- fmt --check reference-backend` exits non-zero
- `cargo run -q -p meshc -- build mesher` or `cargo run -q -p meshc -- build reference-backend` exits non-zero
- `rg -n '^from .{121,}' mesher -g '*.mpl'` returns any match
- `rg -n '^from .*\. ' mesher reference-backend -g '*.mpl'` returns any match
- `/tmp/m029-s03-fmt-mesher.log` contains output on a supposedly green run
- `reference-backend/api/health.mpl` no longer shows the canonical multiline import anchor used by the slice

## Requirements Proved By This UAT

- R024 — proves Mesher’s remaining long imports were converted to the canonical multiline form and all remaining formatter-red Mesher files were moved onto canonical formatter output
- R011 — proves the slice closed with truthful compiler/formatter checks instead of hand-waved cleanup
- R026 — proves `reference-backend/` remained a clean regression target through the final formatter wave
- R027 — proves dotted-path corruption checks stayed green while formatter/build compliance was restored

## Not Proven By This UAT

- Runtime behavior of Mesher or `reference-backend` under live traffic
- Postgres-backed integration flows, migrations, or worker recovery behavior
- Broader milestone acceptance outside the formatter/build/import-shape scope of S03

## Notes for Tester

Current canonical formatter output still includes spaces around generic/result-type syntax and compact `do|state|` handler separators in some files. Those shapes are accepted output for this slice; judge regressions by formatter/build gates, import-shape checks, and the preserved `reference-backend/api/health.mpl` smoke target rather than by those aesthetics alone.
