# Phase 141: Dogfeed v14 Changes to Mesher - Research

**Researched:** 2026-03-01
**Domain:** Mesh application update — integrating v14.0 stdlib APIs (Crypto, DateTime, HTTP client, Testing Framework) into the Mesher production codebase
**Confidence:** HIGH

## Summary

Phase 141 follows the established dogfooding pattern from Phase 120 (v12.0: slot pipe + string interpolation) and Phase 130 (v13.0: multi-line pipes + type aliases). The goal is to update Mesher's ~32 `.mpl` source files to use v14.0 features where they genuinely improve the code, then verify the application compiles and runs correctly.

The Mesher is a production monitoring platform (Sentry-like issue tracker) written in Mesh. It currently uses PostgreSQL's `pgcrypto` extension for cryptographic operations — random token generation (`gen_random_bytes`), password hashing (`crypt`/`gen_salt`), and UUID generation. Several of these operations can be replaced with the new Crypto stdlib (`Crypto.uuid4()`, `Crypto.hmac_sha256()`, `Crypto.secure_compare()`). The most impactful changes are: (1) replacing PostgreSQL-based token/UUID generation with Mesh-native Crypto stdlib, (2) adding a `mesh.toml` manifest to declare Mesher as a package, and (3) writing `*.test.mpl` test files for pure utility functions using the new Testing Framework.

The HTTP client improvements (fluent builder API, streaming) are NOT a good fit for the current Mesher — Mesher is an HTTP server, not an HTTP client. DateTime stdlib has limited applicability because all timestamp logic lives in SQL queries. The high-value dogfeed targets are Crypto stdlib and the Testing Framework.

**Primary recommendation:** Focus dogfeed on three concrete areas: (1) replace pgcrypto-backed token/API-key generation and HMAC auth verification with Crypto stdlib, (2) add `mesh.toml` package manifest to establish Mesher as a Mesh package, (3) write `mesher/*.test.mpl` files for pure functions like `fingerprint.mpl` and `validation.mpl` using the new test framework.

## Standard Stack

### Core (v14.0 stdlib modules already compiled into Mesh runtime)

| Module | API | Purpose in Mesher | Already Used? |
|--------|-----|-------------------|---------------|
| `Crypto` | `Crypto.uuid4()`, `Crypto.hmac_sha256()`, `Crypto.secure_compare()` | Replace pgcrypto UUID/token generation, HMAC API key verification | No |
| `Base64` | `Base64.encode()`, `Base64.decode()` | No current need — fingerprints and tokens are hex | No |
| `Hex` | `Hex.encode()`, `Hex.decode()` | Complement Crypto; may replace `encode(bytes, 'hex')` pattern | No |
| `DateTime` | `DateTime.utc_now()`, `DateTime.to_iso8601()`, `DateTime.add()` | Limited — timestamps live in SQL; possible for session expiry | No |
| `Test` | `test()`, `assert`, `assert_eq`, `describe`, `setup`, `teardown`, `Test.mock_actor`, `assert_receive` | Write unit tests for pure Mesher functions | No |
| `meshpkg` / `mesh.toml` | Package manifest | Declare Mesher as a Mesh package | No (no `mesh.toml` found) |

### No stdlib needed for these (already idiomatic)

| Feature | Status |
|---------|--------|
| Slot pipe `\|2>` | Already used in `fingerprint.mpl` (Phase 120) |
| String interpolation `#{...}` | Already used throughout (Phase 120) |
| Heredocs `"""..."""` | Already used (Phase 120) |
| Multi-line `\|>` pipes | Already used in `main.mpl` (Phase 130) |
| Type aliases | Already used (`Fingerprint` in `types/event.mpl`, Phase 130) |

## Architecture Patterns

### Pattern 1: Replace pgcrypto UUID/token generation with Crypto stdlib

**What:** `Storage.Queries` uses `Repo.query_raw` with `SELECT encode(gen_random_bytes(N), 'hex')` or `SELECT gen_random_uuid()` to generate tokens/UUIDs at the database layer. The v14.0 Crypto stdlib can do this in Mesh directly.

**When to use:** Anywhere the Mesher round-trips to PostgreSQL solely to generate random data.

**Current code pattern (in `storage/queries.mpl`):**
```mpl
# Step 1: Generate API key value via PG (mshr_ prefix + 48 hex chars)
let key_rows = Repo.query_raw(pool, "SELECT 'mshr_' || encode(gen_random_bytes(24), 'hex') AS key_value", [])?
if List.length(key_rows) > 0 do
  let key_value = Map.get(List.head(key_rows), "key_value")
  ...
```

**After applying Crypto stdlib:**
```mpl
# Crypto.uuid4() / Hex.encode on random bytes -- no DB round-trip needed
let token = "mshr_" <> Crypto.uuid4()  # or use Hex.encode approach
```

**Current session token generation:**
```mpl
let token_rows = Repo.query_raw(pool, "SELECT encode(gen_random_bytes(32), 'hex') AS token", [])?
```

**After:**
```mpl
# Crypto.uuid4() generates 128-bit cryptographically random value
# Two UUIDs concatenated (without hyphens) = 64 hex chars matching current format
let uuid1 = Crypto.uuid4()
let uuid2 = Crypto.uuid4()
# Strip hyphens to get 32 hex chars each, concatenate for 64-char token
```

**Pitfall:** The Mesher's session tokens are currently 64-char hex strings. `Crypto.uuid4()` returns a 36-char UUID with hyphens. Need to verify format compatibility or use a different approach (e.g., `Hex.encode(Crypto.uuid4())`). The simplest safe replacement: use `Crypto.uuid4()` to get randomness then format as needed.

**Pitfall 2:** Password hashing uses `crypt()`/`gen_salt('bf', 12)` — this is bcrypt. The v14.0 Crypto stdlib only has SHA-256/512, HMAC, and UUID. bcrypt is NOT available. Password hashing MUST stay as pgcrypto. Do not attempt to replace `create_user` or `authenticate_user`.

### Pattern 2: HMAC-based API key verification (Crypto.secure_compare)

**What:** API key verification currently compares keys via SQL `WHERE ak.key_value = ?`. For timing-safe comparison in the Mesh layer, `Crypto.secure_compare(a, b)` can be used if key comparison moves to the application layer.

**Current pattern:** SQL-side equality check (safe from SQL injection, but comparison is at DB layer).

**Consideration:** The current approach is already secure (parameterized SQL). `Crypto.secure_compare` would be more relevant if the Mesher were doing HMAC token verification in Mesh code. This is LOW priority — the current approach is correct.

**Better use:** If adding HMAC-based webhook signatures or API request signing to Mesher, `Crypto.hmac_sha256(key, msg)` and `Crypto.secure_compare` would be the right tools.

### Pattern 3: mesh.toml package manifest

**What:** Add `mesh.toml` to `mesher/` directory declaring Mesher as a Mesh package.

**Where:** `mesher/mesh.toml` (new file)

**Pattern:**
```toml
[package]
name = "mesher"
version = "1.0.0"
description = "Mesher monitoring platform — Sentry-compatible issue tracker written in Mesh"
license = "MIT"

[dependencies]
# No external dependencies yet — uses Mesh stdlib only
```

**Why it matters:** This dogfeeds PKG-01 (package manifest) and establishes Mesher as a first-class package in the Mesh ecosystem. It can then be published to the new registry (Phase 140) as a showcase application.

### Pattern 4: Test files for pure utility functions

**What:** Write `*.test.mpl` files for functions with no DB dependencies — pure logic that can be tested in isolation.

**Best candidates in Mesher for testing:**

| Module | Functions testable | Why |
|--------|-------------------|-----|
| `ingestion/fingerprint.mpl` | `compute_fingerprint`, `normalize_message`, `fingerprint_from_frames` | Pure string manipulation — no DB, no actors |
| `ingestion/validation.mpl` | `validate_level`, `validate_event`, `validate_payload_size`, `validate_bulk_count` | Pure validation logic — ideal unit test targets |
| `ingestion/auth.mpl` | `extract_api_key` | Pure header extraction — no DB lookup needed |

**Test structure pattern (from `tests/e2e/test_basic.test.mpl`):**
```mpl
# mesher/tests/fingerprint.test.mpl
from Ingestion.Fingerprint import compute_fingerprint
from Types.Event import EventPayload

test("compute_fingerprint uses custom fingerprint if set") do
  let payload = EventPayload { message: "test", level: "error", fingerprint: "custom-fp", exception: None, stacktrace: None, breadcrumbs: None, tags: "{}", extra: "{}", user_context: "{}", sdk_name: None, sdk_version: None }
  let fp = compute_fingerprint(payload)
  assert_eq(fp, "custom-fp")
end

test("normalize_message lowercases and strips 0x prefixes") do
  # ... etc
end
```

**Placement:** `mesher/tests/` subdirectory to keep test files separate from source.

**Constraint:** Test files that import from other modules must be under the `mesher/` directory tree for `meshc test` to find them. The `meshc test` runner compiles each `.test.mpl` as a complete Mesh program — cross-module imports work if the test file has proper `from ... import` statements.

### Pattern 5: DateTime stdlib for session expiry visibility

**What:** The mesher has session expiry logic in SQL (`expires_at > now()` in `validate_session`). The application doesn't currently compute session expiry in Mesh — it happens server-side in PostgreSQL. DateTime stdlib could be used if the Mesher needs to compute or display session expiry times in Mesh code.

**Assessment:** LOW value for current Mesher. The SQL approach is correct and simpler. DateTime stdlib dogfeed opportunity is limited unless adding a new feature (e.g., showing "session expires in N days" in an API response).

### Recommended Project Structure After Phase 141

```
mesher/
├── mesh.toml            # NEW: package manifest (Phase 141)
├── main.mpl
├── api/
│   └── *.mpl
├── ingestion/
│   └── *.mpl
├── migrations/
│   └── *.mpl
├── services/
│   └── *.mpl
├── storage/
│   └── *.mpl
├── tests/               # NEW: test directory (Phase 141)
│   ├── fingerprint.test.mpl
│   └── validation.test.mpl
└── types/
    └── *.mpl
```

### Anti-Patterns to Avoid

- **Replacing bcrypt with Crypto stdlib:** `Crypto.pbkdf2` is v14.1+ future work. `crypt()`/`gen_salt('bf')` must stay as pgcrypto. Never replace `create_user`/`authenticate_user` password hashing.
- **Adding HTTP client calls to Mesher:** Mesher is an HTTP server. Adding outgoing HTTP calls for webhooks or external integrations would be a feature addition, not dogfooding.
- **Testing DB-dependent functions:** Functions that take `pool :: PoolHandle` cannot be unit tested without a running PostgreSQL instance. Focus tests on pure functions.
- **Forcing DateTime where SQL timestamps work fine:** The Mesher's timestamp handling is fully correct in PostgreSQL. DateTime stdlib would add complexity for no gain.
- **Breaking the two-step pgcrypto pattern for password hashing:** The `crypt()` hash comparison works because the hash is verified server-side. Replacing this would require changing authentication logic significantly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cryptographically random token generation | Custom LCG or timestamp-based ID | `Crypto.uuid4()` | Crypto-grade randomness; correct UUID v4 format |
| HMAC-based request signing | Manual SHA-256 + string concat | `Crypto.hmac_sha256(key, msg)` + `Crypto.secure_compare(a, b)` | Timing-safe comparison; correct RFC 2202 implementation |
| Test runner infrastructure | Custom test harness | `meshc test` + `*.test.mpl` | Already built in Phase 138; designed exactly for this |
| Package manifest format | Custom TOML structure | `mesh.toml` format (Phase 139) | Standard format the registry understands |

**Key insight:** The Mesher already solved its crypto needs by delegating to pgcrypto. The v14 dogfeed should replace only the cases where pgcrypto is used purely for randomness (not for bcrypt password hashing, which has no Mesh stdlib equivalent).

## Common Pitfalls

### Pitfall 1: Attempting to Replace bcrypt Password Hashing
**What goes wrong:** Developer sees `crypt()`/`gen_salt('bf')` in `create_user` and `authenticate_user` and tries to replace with Crypto stdlib.
**Why it happens:** The SHA-256/HMAC functions look like they could replace crypto operations.
**How to avoid:** `Crypto.sha256` and `Crypto.hmac_sha256` are NOT password hashing functions (no key stretching, no salt iteration). `Crypto.pbkdf2` exists only in v14.1 future requirements. Password hashing stays in pgcrypto.
**Warning signs:** If `create_user` or `authenticate_user` in `storage/queries.mpl` are being modified.

### Pitfall 2: Session Token Format Incompatibility
**What goes wrong:** Replacing the 64-hex-char session token with a UUID v4 string (36 chars with hyphens) breaks existing sessions and any clients that validate token length/format.
**Why it happens:** `Crypto.uuid4()` returns `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` format, not a raw hex string.
**How to avoid:** If replacing session token generation, generate two UUIDs and strip hyphens to maintain 64-char hex format. Or use `Hex.encode(Crypto.uuid4())` pattern. Verify the token column type in migrations before changing.
**Warning signs:** Token length or format changes in `create_session`.

### Pitfall 3: Test Files That Import DB-Dependent Code
**What goes wrong:** Writing a test that imports from `Storage.Queries` will fail because it needs a live PostgreSQL connection.
**Why it happens:** `meshc test` compiles and executes each `.test.mpl` as a standalone program; there's no DB fixture system.
**How to avoid:** Only test pure functions — those without `pool :: PoolHandle` parameters. The `ingestion/fingerprint.mpl` and `ingestion/validation.mpl` modules are the ideal targets.
**Warning signs:** Any test importing from `Storage.Queries`, `Services.*`, or using `Pool.open`.

### Pitfall 4: meshc test Discovery Requires .test.mpl Files Under mesher/
**What goes wrong:** Tests placed outside `mesher/` can't import mesher modules.
**Why it happens:** `meshc test` runs each `*.test.mpl` as a complete program. Cross-module imports (`from Ingestion.Fingerprint import`) resolve relative to the directory structure.
**How to avoid:** Place test files inside `mesher/tests/` so `from Ingestion.Fingerprint import` resolves correctly. Verify with `meshc test mesher/` to run all tests under that tree.
**Warning signs:** `module not found` errors when running `meshc test`.

### Pitfall 5: API Key Token Prefix Format
**What goes wrong:** Current API keys have `mshr_` prefix + 48 hex chars (from `encode(gen_random_bytes(24), 'hex')`). If replacing with `Crypto.uuid4()`, the length and format changes.
**Why it happens:** UUID v4 produces 32 hex chars (no hyphens) vs 48 chars for `gen_random_bytes(24)`.
**How to avoid:** Choose consistent format — either keep pgcrypto for API keys (they're stored in DB, not compared in Mesh), or use `"mshr_" <> Crypto.uuid4()` accepting the different length. Document the decision.

### Pitfall 6: meshc test vs meshc build — Different Entry Points
**What goes wrong:** `meshc test` discovers `*.test.mpl` files; `meshc build mesher/` builds `main.mpl`. Test files in `mesher/` directory would be found by both — but test files don't need a `fn main()`.
**Why it happens:** The test runner handles entry points differently from the build system.
**How to avoid:** Test files should NOT have a `fn main()` function — they use `test("...")` top-level declarations only. Verify compilation with both `meshc test mesher/tests/` and `meshc build mesher/`.

## Code Examples

### Crypto.uuid4() as token generator

```mpl
# Source: Phase 135 stdlib (builtins.rs registration + intrinsics.rs)
# Replace pgcrypto gen_random_bytes for non-password token generation

# Before (two-step pgcrypto pattern):
let token_rows = Repo.query_raw(pool, "SELECT encode(gen_random_bytes(32), 'hex') AS token", [])?
let token = Map.get(List.head(token_rows), "token")

# After (single Mesh call, no DB round-trip):
let token = Crypto.uuid4() <> Crypto.uuid4()  # Two UUIDs = 72 chars total
# Note: strips hyphens if 64-char hex format required:
# let raw = Crypto.uuid4() <> Crypto.uuid4()
# let token = raw |2> String.replace("-", "")  # Slot pipe: |2> inserts as second arg
```

### Test file for fingerprint.mpl

```mpl
# Source: Phase 138 testing framework (meshc test runner pattern)
# File: mesher/tests/fingerprint.test.mpl

from Ingestion.Fingerprint import compute_fingerprint
from Types.Event import EventPayload

test("uses custom fingerprint when set") do
  let payload = EventPayload {
    message: "test error",
    level: "error",
    fingerprint: "my-custom-fp",
    exception: None,
    stacktrace: None,
    breadcrumbs: None,
    tags: "{}",
    extra: "{}",
    user_context: "{}",
    sdk_name: None,
    sdk_version: None
  }
  let fp = compute_fingerprint(payload)
  assert_eq(fp, "my-custom-fp")
end

test("falls back to message fingerprint when no exception or stacktrace") do
  let payload = EventPayload {
    message: "something 0x1234 failed",
    level: "error",
    fingerprint: "",
    exception: None,
    stacktrace: None,
    breadcrumbs: None,
    tags: "{}",
    extra: "{}",
    user_context: "{}",
    sdk_name: None,
    sdk_version: None
  }
  let fp = compute_fingerprint(payload)
  # normalize_message lowercases and strips 0x prefix:
  assert_eq(fp, "msg:something  failed")
end
```

### Test file for validation.mpl

```mpl
# Source: Phase 138 testing framework
# File: mesher/tests/validation.test.mpl

from Ingestion.Validation import validate_level, validate_payload_size, validate_bulk_count

describe("validate_level") do
  test("accepts valid levels") do
    assert_eq(validate_level("error"), Ok("valid"))
    assert_eq(validate_level("warning"), Ok("valid"))
    assert_eq(validate_level("fatal"), Ok("valid"))
    assert_eq(validate_level("info"), Ok("valid"))
    assert_eq(validate_level("debug"), Ok("valid"))
  end

  test("rejects unknown level") do
    let result = validate_level("critical")
    case result do
      Err(_) -> assert(true)
      Ok(_) -> assert(false)
    end
  end
end

describe("validate_payload_size") do
  test("accepts body within limit") do
    assert_eq(validate_payload_size("hello", 100), Ok("ok"))
  end

  test("rejects body over limit") do
    let result = validate_payload_size("hello world", 5)
    case result do
      Err(_) -> assert(true)
      Ok(_) -> assert(false)
    end
  end
end
```

### mesh.toml manifest

```toml
# File: mesher/mesh.toml
[package]
name = "mesher"
version = "1.0.0"
description = "Mesher monitoring platform — production-grade issue tracker written in Mesh"
license = "MIT"

[dependencies]
# No external mesh package dependencies yet
```

## State of the Art

| Old Approach | Current Approach | Since | Impact for Phase 141 |
|--------------|------------------|-------|----------------------|
| Manual string concat in println | `#{expr}` interpolation | v12.0 (Phase 120) | Already done — no change needed |
| `HTTP.serve((router |> ...))` inline | `let router = HTTP.router() \|> ...` multi-line | v13.0 (Phase 130) | Already done — no change needed |
| No type aliases | `pub type Fingerprint = String` | v13.0 (Phase 130) | Already done — no change needed |
| pgcrypto for ALL crypto ops | pgcrypto for bcrypt only; Crypto stdlib for UUID/token gen | v14.0 (Phase 141) | NEW in this phase |
| No test infrastructure | `*.test.mpl` + `meshc test` | v14.0 (Phase 141) | NEW in this phase |
| No package manifest | `mesh.toml` | v14.0 (Phase 141) | NEW in this phase |

**Deprecated/outdated for this phase:**
- `Repo.query_raw(pool, "SELECT encode(gen_random_bytes(N), 'hex') AS token", [])` for pure token generation — use `Crypto.uuid4()` instead

## Open Questions

1. **Can `meshc test` discover tests inside subdirectories of a mesher/ tree?**
   - What we know: `meshc test` discovers `*.test.mpl` files in the directory passed to it (Phase 138 Plan 01: "discovery of `*.test.mpl` files").
   - What's unclear: Does `meshc test mesher/` recursively find `mesher/tests/*.test.mpl`?
   - Recommendation: Test with `meshc test mesher/tests/` explicitly if recursive discovery is uncertain. The planner should include a verification step.

2. **Does `Crypto.uuid4()` output format work for session token replacement?**
   - What we know: `Crypto.uuid4()` returns `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` (36 chars with hyphens). Current tokens are 64-char hex.
   - What's unclear: Whether stripping hyphens from two UUIDs (`32 + 32 = 64 chars`) is the right approach, or if changing token length is acceptable.
   - Recommendation: The planner can decide between: (a) keep pgcrypto for token generation (zero risk), (b) use `Crypto.uuid4() <> Crypto.uuid4()` and strip hyphens to maintain 64-char hex format, (c) accept UUID format tokens (36 chars). Option (a) is safest for this phase.

3. **Are there cross-module import constraints for test files?**
   - What we know: Phase 138 Plan 01 states "test_runner copies each `*.test.mpl` to temp dir as `main.mpl`". This might affect cross-module imports.
   - What's unclear: Whether `from Ingestion.Fingerprint import` resolves correctly when the test file is treated as a standalone program in a temp directory.
   - Recommendation: Test files should use only self-contained imports from modules within the same directory tree. The planner should verify with a simple test that imports from `fingerprint.mpl` first.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `/Users/sn0w/Documents/dev/mesh/mesher/**/*.mpl` — all 32 source files read
- Phase 120 Plan (120-01-PLAN.md) — established dogfeed pattern: read all files, update where genuinely better, preserve semantics
- Phase 130 Plan (130-01-PLAN.md) — established dogfeed pattern: type aliases + multi-line pipes
- Phase 135 (REQUIREMENTS.md CRYPTO-*, ENCODE-*) — Crypto and Encoding stdlib APIs verified
- Phase 138 (REQUIREMENTS.md TEST-*) — Testing Framework APIs verified
- Phase 139 (REQUIREMENTS.md PKG-01) — mesh.toml format verified
- STATE.md — decisions log, especially Phase 138 Plan 01 test_runner behavior

### Secondary (MEDIUM confidence)
- Pattern analysis: pgcrypto functions identified as replaceable (token/UUID generation only, NOT bcrypt)
- Test placement strategy: inferred from Phase 138 Plan 01 "copies to temp dir as main.mpl" — cross-module tests may need special handling

### Tertiary (LOW confidence)
- meshc test recursive subdirectory discovery behavior — needs empirical verification during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs verified from requirements + code inspection
- Architecture patterns: HIGH — based on direct codebase read + established dogfeed patterns
- Pitfalls: HIGH — derived from actual code analysis (bcrypt is pgcrypto, token formats confirmed)
- Test strategy: MEDIUM — meshc test behavior for mesher/ subdirectory imports needs verification

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable — Mesh stdlib APIs are complete for v14.0)

---

## Appendix: Mesher File Inventory

### Files changed in previous dogfeed phases (already modernized)
- `mesher/ingestion/fingerprint.mpl` — slot pipe (Phase 120), Fingerprint type alias (Phase 130)
- `mesher/ingestion/pipeline.mpl` — string interpolation, heredocs (Phase 120)
- `mesher/ingestion/routes.mpl` — string interpolation, heredocs (Phase 120)
- `mesher/main.mpl` — string interpolation (Phase 120), multi-line router pipe (Phase 130)
- `mesher/services/retention.mpl` — string interpolation (Phase 120)
- `mesher/services/writer.mpl` — string interpolation (Phase 120)
- `mesher/types/event.mpl` — Fingerprint type alias (Phase 130)

### Files that are strong candidates for Phase 141 changes

| File | v14 Feature | Change Description |
|------|-------------|-------------------|
| `mesher/storage/queries.mpl` | Crypto stdlib | Replace `SELECT encode(gen_random_bytes(32), 'hex')` with `Crypto.uuid4()` in `create_session`; replace `SELECT 'mshr_' \|\| encode(gen_random_bytes(24), 'hex')` in `create_api_key` |
| `mesher/mesh.toml` (new) | PKG manifest | Create package manifest declaring Mesher as a Mesh package |
| `mesher/tests/fingerprint.test.mpl` (new) | Testing Framework | Test `compute_fingerprint`, `normalize_message` pure logic |
| `mesher/tests/validation.test.mpl` (new) | Testing Framework | Test `validate_level`, `validate_payload_size`, `validate_bulk_count` |

### Files that are LOW priority / no change needed

| File | Reason |
|------|--------|
| `mesher/storage/queries.mpl` (password ops) | bcrypt must stay in pgcrypto — no v14 stdlib equivalent |
| `mesher/services/*.mpl` | Actor services — no v14 feature applies |
| `mesher/api/*.mpl` | HTTP handlers already idiomatic — no v14 feature applies |
| `mesher/types/*.mpl` | Type definitions — no v14 feature applies (no new types needed) |
| `mesher/ingestion/ws_handler.mpl` | WebSocket handler — no v14 feature applies |
| `mesher/migrations/*.mpl` | SQL migrations — no v14 feature applies |
