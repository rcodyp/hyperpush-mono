---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Ecosystem & Standard Library
status: unknown
last_updated: "2026-02-28T08:36:45.366Z"
progress:
  total_phases: 124
  completed_phases: 124
  total_plans: 323
  completed_plans: 323
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** Expressive, readable concurrency -- writing concurrent programs should feel as natural and clean as writing sequential code, with the safety net of supervision and fault tolerance built into the language.
**Current focus:** v14.0 Phase 137 — HTTP Client Improvements (Phase 136 complete)

## Current Position

Phase: 137 of 140 (HTTP Client Improvements)
Plan: 0 of 2 in current phase
Status: Not started
Last activity: 2026-02-28 — Phase 136 Plan 02 complete: 6 DateTime e2e tests pass; 10 compiler bug fixes (MirType::Int registration, boxed scalar deref, atom unit params, is_before/is_after naming)

Progress: [███░░░░░░░] 23%  (3/13 plans)

## Performance Metrics

**All-time Totals (through v13.0):**
- Plans completed: 362
- Phases completed: 134
- Milestones shipped: 23 (v1.0-v13.0)

**v14.0 plan (13 plans across 6 phases):**

| Phase | Plans | Status |
|-------|-------|--------|
| 135. Encoding & Crypto Stdlib | 2 | Complete |
| 136. DateTime Stdlib | 2 | Complete |
| 137. HTTP Client Improvements | 2 | Not started |
| 138. Testing Framework | 3 | Not started |
| 139. Package Manifest & meshpkg CLI | 2 | Not started |
| 140. Package Registry Backend & Website | 2 | Not started |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v14.0 Research]: DateTime uses i64 Unix milliseconds — not an opaque heap handle, not strings; avoids new type machinery in typeck/codegen
- [v14.0 Research]: HTTP streaming uses dedicated OS thread per stream (WS reader pattern from v4.0), NOT blocking inside actor coroutines — prevents scheduler deadlock
- [v14.0 Research]: Each *.test.mpl is a complete Mesh program; runner compiles and executes each independently — no function-level test injection
- [v14.0 Research]: Registry package versions are immutable from day one; HTTP 409 on duplicate publish
- [v14.0 Research]: Exact versions only in mesh.toml (no SemVer range solving in v14.0)
- [v14.0 Research]: Coverage (TEST-10) treated as stretch/stub in Phase 138 — MIR counter injection approach; defer full impl to v14.1
- [v14.0 Roadmap]: Phase 135 (Crypto+Encoding) and Phase 136 (DateTime) and Phase 137 (HTTP) and Phase 138 (Testing) all depend only on Phase 134 — can be developed in any order
- [v14.0 Roadmap]: Phase 139 (PKG) depends on Phase 138 (testing framework useful before publishing) — but also logically follows registry API contract
- [v14.0 Roadmap]: Phase 140 (Registry) depends on Phase 139 — manifest format must be finalized before API contract
- [Phase 135 Plan 01]: stdlib module requires 5 registration points: builtins.rs, infer.rs stdlib_modules() HashMap, infer.rs STDLIB_MODULE_NAMES, lower.rs STDLIB_MODULES + map_builtin_name + known_functions, intrinsics.rs LLVM declarations
- [Phase 135 Plan 01]: HMAC-SHA256 RFC 2202 test vector for ("Jefe", "what do ya want for nothing?") = 5bdcc146...ec3843 (not a72840 as in plan)
- [Phase 135 Plan 02]: Base64.decode lenient order: try STANDARD (padded) first, then STANDARD_NO_PAD — if unpadded first, padded input gets bytes incorrectly stripped
- [Phase 135 Plan 02]: Hex.decode is case-insensitive via to_lowercase() before parsing — accepts both lowercase and uppercase hex digits
- [Phase 136 Plan 01]: DateTime ABI is i64 Unix milliseconds throughout — avoids new type machinery in typeck/codegen
- [Phase 136 Plan 01]: diff() return type is MirType::Float (f64) not MirType::Int — fractional precision for sub-second computations
- [Phase 136 Plan 01]: before?/after? retain ? in Mesh source names but drop ? in C symbol names (C cannot contain ?)
- [Phase 136 Plan 01]: alloc_result Ok i64 payload boxed via Box::into_raw(Box::new(ms)) as *mut u8 — same pattern as SqliteConn
- [Phase 136 Plan 02]: Opaque named types backed by scalar ABI must be registered as MirType::Int in resolve_con (not MirType::Struct)
- [Phase 136 Plan 02]: should_deref_boxed_payload must cover MirType::Int/Float/Bool — any scalar type returned via Box::into_raw needs deref in Ok pattern binding
- [Phase 136 Plan 02]: Atom literals lower to bare names without colon — atom_text() strips leading ':'; runtime match arms use "day" not ":day"
- [Phase 136 Plan 02]: is_before/is_after preferred over before?/after? — '?' is Mesh try-operator and 'after' is AFTER_KW (receive-timeout); both block parsing

### Pending Todos

None.

### Blockers/Concerns

- [Phase 138]: Coverage (TEST-10) has HIGH implementation risk per research — LLVM incompatible with current codegen; plan as stub (--coverage flag accepted, outputs "not yet supported" or basic MIR counter prototype)
- [Phase 140]: Registry storage abstraction (StorageBackend trait for S3/R2 migration path) needs design decision at planning time
- [Phase 140]: Empty registry at launch ("ghost town" problem) — plan to publish stdlib packages as seed content during Phase 140

## Session Continuity

Last session: 2026-02-28
Stopped at: Phase 136 Plan 02 complete — all 6 e2e_datetime_* tests pass; Phase 136 (DateTime Stdlib) fully complete; ready for Phase 137 (HTTP Client Improvements)
Resume file: None
