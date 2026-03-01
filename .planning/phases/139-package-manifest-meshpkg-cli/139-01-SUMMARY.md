---
phase: 139-package-manifest-meshpkg-cli
plan: "01"
subsystem: mesh-pkg
tags: [package-manager, manifest, lockfile, registry, serde]
dependency_graph:
  requires: []
  provides: [PKG-01, PKG-02]
  affects: [compiler/mesh-pkg]
tech_stack:
  added: [ureq 3 (gzip), sha2 0.10]
  patterns: [serde untagged enum ordering for TOML disambiguation, #[serde(default)] for backward-compatible lockfile evolution]
key_files:
  created: []
  modified:
    - compiler/mesh-pkg/src/manifest.rs
    - compiler/mesh-pkg/src/lockfile.rs
    - compiler/mesh-pkg/src/resolver.rs
    - compiler/mesh-pkg/src/lib.rs
    - compiler/mesh-pkg/Cargo.toml
decisions:
  - "RegistryShorthand must be FIRST in the Dependency enum for serde untagged deserialization — a bare string '1.0.0' must match before Git/Path are tried"
  - "version field in LockedPackage uses String (not Option<String>) with #[serde(default)] so it deserializes as empty string from old lockfiles"
  - "Registry deps in resolve_deps() return an error directing users to run meshpkg install — network resolution belongs in the CLI binary (Plan 02)"
metrics:
  duration: "2m 12s"
  completed: "2026-03-01"
  tasks_completed: 2
  files_modified: 5
---

# Phase 139 Plan 01: Package Manifest Registry Extension Summary

Extended mesh-pkg library with registry dependency types (RegistryShorthand + Registry table form), sha256 content-addressing in lockfile, license field in Package, and full re-exports for the meshpkg CLI binary (Plan 02).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend manifest.rs with Registry dependency variants and license field | 445fe832 | compiler/mesh-pkg/src/manifest.rs |
| 2 | Extend lockfile.rs, resolver.rs, lib.rs, Cargo.toml | 445fe832 | compiler/mesh-pkg/src/lockfile.rs, resolver.rs, lib.rs, Cargo.toml |

Note: Tasks 1 and 2 were committed together because adding new Dependency variants to manifest.rs immediately causes a non-exhaustive match compile error in resolver.rs. Both changes are required for the crate to compile.

## What Was Built

### manifest.rs
- Added `RegistryShorthand(String)` variant — matches bare string `foo = "1.0.0"` in TOML
- Added `Registry { version: String }` variant — matches table form `foo = { version = "1.0.0" }`
- Both variants placed BEFORE Git and Path so serde's untagged deserialization tries them first
- Added `license: Option<String>` to Package struct with `#[serde(default)]`
- Added `Dependency::registry_version() -> Option<&str>` helper
- Added `Dependency::is_registry() -> bool` helper
- 4 new tests: `parse_registry_shorthand`, `parse_registry_table_form`, `parse_mixed_dependency_types`, `parse_license_field`

### lockfile.rs
- Added `version: String` field with `#[serde(default)]` — empty string for git/path deps
- Added `sha256: Option<String>` field with `#[serde(default)]` — None for git/path deps
- Both fields backward-compatible: old lockfiles without them deserialize correctly
- 2 new tests: `lockfile_registry_package_with_sha256`, `lockfile_backward_compat_no_sha256`

### resolver.rs
- Added `RegistryShorthand | Registry` arm to match in `resolve_deps()` — returns error directing users to run `meshpkg install`
- Updated `resolve_dependencies()` LockedPackage construction with `version: String::new()` and `sha256: None`

### lib.rs
- Extended re-exports: `Dependency`, `Package`, `LockedPackage`, `Lockfile` now all publicly re-exported

### Cargo.toml
- Added `ureq = { version = "3", features = ["gzip"] }` for registry HTTP downloads (Plan 02)
- Added `sha2 = "0.10"` for tarball integrity verification (Plan 02)

## Verification

```
test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

All 30 tests pass: 24 pre-existing + 6 new.

## Deviations from Plan

### Structural Note: Tasks 1 and 2 Committed Together

- **Found during:** Task 1 verification attempt
- **Issue:** Adding new Dependency variants in manifest.rs immediately causes a non-exhaustive match compile error in resolver.rs (E0004). The two tasks cannot independently compile.
- **Fix:** Executed both tasks before running tests, then committed all changes in a single atomic commit.
- **Impact:** Functionally identical to two separate commits — all work from both tasks is present and verified.

No other deviations.

## Self-Check: PASSED

Files exist:
- compiler/mesh-pkg/src/manifest.rs — FOUND
- compiler/mesh-pkg/src/lockfile.rs — FOUND
- compiler/mesh-pkg/src/resolver.rs — FOUND
- compiler/mesh-pkg/src/lib.rs — FOUND
- compiler/mesh-pkg/Cargo.toml — FOUND

Commit 445fe832 — FOUND (30 tests passing)
