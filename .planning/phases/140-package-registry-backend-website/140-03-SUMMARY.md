---
phase: 140-package-registry-backend-website
plan: "03"
subsystem: auth
tags: [github-oauth, tower-sessions, argon2, axum, postgres, reqwest]

# Dependency graph
requires:
  - phase: 140-01
    provides: AppState with oauth_client, db::tokens functions (upsert_user, create_token, list_tokens), AppError enum

provides:
  - GitHub OAuth login flow (/auth/github -> GitHub -> /auth/callback)
  - Session-backed user identity stored in PostgreSQL via tower-sessions
  - Dashboard HTML page at /dashboard showing logged-in user
  - Token creation API: POST /dashboard/tokens returns raw token once (argon2 hash in DB)
  - Token list API: GET /dashboard/tokens returns JSON list
  - .env.example documenting all required environment variables with dev defaults

affects:
  - future publish routes that call db::tokens::validate_bearer_token
  - meshpkg CLI login flow that stores the raw token from POST /dashboard/tokens

# Tech tracking
tech-stack:
  added:
    - reqwest 0.11 (explicit dep, was transitive via oauth2)
    - time 0.3 (for tower-sessions Expiry::OnInactivity duration)
    - tower-sessions-sqlx-store 0.15 PostgresStore (was already in Cargo.toml)
  patterns:
    - Session as axum extractor (tower-sessions 0.14)
    - CSRF state stored/cleared in session around OAuth round-trip
    - require_session() helper returns (Uuid, String) or Unauthorized error
    - Raw token returned once to caller; only argon2 PHC hash stored in DB

key-files:
  created:
    - registry/src/routes/auth.rs
    - registry/.env.example
  modified:
    - registry/src/main.rs
    - registry/src/routes/mod.rs
    - registry/Cargo.toml

key-decisions:
  - "PostgresStore from tower-sessions-sqlx-store (separate crate), not tower-sessions itself — import path is tower_sessions_sqlx_store::PostgresStore"
  - "time::Duration::days(30) for session expiry — tower-sessions uses the time crate, not std::time"
  - "reqwest 0.11 explicit dep for fetch_github_user — matches transitive version pulled in by oauth2 4.4"
  - "session.remove::<String>(SESSION_CSRF) called immediately after retrieval to prevent replay"

patterns-established:
  - "Session extractor: async fn handler(session: Session) — no middleware needed, tower-sessions provides as axum extractor"
  - "Dashboard auth guard: match session.get::<String>(SESSION_GITHUB_LOGIN).await — redirect to /auth/github if None"

requirements-completed: [REG-01]

# Metrics
duration: 15min
completed: 2026-03-01
---

# Phase 140 Plan 03: GitHub OAuth and Token Dashboard Summary

**GitHub OAuth login via tower-sessions PostgresStore with argon2-hashed publish tokens and single-reveal raw token API**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-01T00:00:00Z
- **Completed:** 2026-03-01T00:15:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Full GitHub OAuth flow: /auth/github redirects to GitHub, /auth/callback exchanges code, verifies CSRF state, fetches user info, upserts user in DB, stores session
- tower-sessions PostgresStore middleware wired in main.rs — sessions survive restarts, stored in same PostgreSQL DB
- Token creation returns raw token exactly once (only argon2 hash stored in DB); list endpoint shows names+ids only
- .env.example documents all 5 environment variable groups with dev defaults and MinIO startup instructions

## Task Commits

1. **Task 1: GitHub OAuth flow and token dashboard** - `6ca063bd` (feat)
2. **Task 2: .env.example** - `8caeae8e` (chore)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `registry/src/routes/auth.rs` - 5 handlers: github_login, github_callback, dashboard, create_token_handler, list_tokens_handler
- `registry/src/main.rs` - tower-sessions PostgresStore middleware added before router
- `registry/src/routes/mod.rs` - auth routes wired: /auth/github, /auth/callback, /dashboard, /dashboard/tokens
- `registry/Cargo.toml` - added reqwest 0.11 and time 0.3 as workspace+package deps
- `registry/.env.example` - all env vars documented with comments and dev defaults

## Decisions Made

- `PostgresStore` is from `tower-sessions-sqlx-store` crate, not `tower-sessions` — used `tower_sessions_sqlx_store::PostgresStore`
- Session expiry uses `time::Duration` (the `time` crate, 0.3), not std — required explicit `time = "0.3"` dep
- reqwest 0.11 added as explicit dep (was transitive via oauth2) to call GitHub user API directly
- CSRF state removed from session immediately after retrieval to prevent replay attacks

## Deviations from Plan

None - plan executed exactly as written. The `tower_sessions::PostgresStore` path mentioned in plan comments was corrected to `tower_sessions_sqlx_store::PostgresStore` per the actual crate structure, but this was noted in the research phase.

## Issues Encountered

None - cargo check passed first attempt with zero errors.

## User Setup Required

**External services require manual configuration.** See `registry/.env.example` for:
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth App (GitHub Settings > Developer settings > OAuth Apps)
- `GITHUB_CALLBACK_URL` — must match callback URL set in the OAuth App (http://localhost:3000/auth/callback for dev)
- `SESSION_SECRET` — generate with `openssl rand -hex 32`
- `DATABASE_URL` — PostgreSQL connection string

## Next Phase Readiness

- Auth complete: GitHub OAuth login and publish token management are functional
- Plan 04 (website) was already completed; registry backend now has full auth for package publishers
- Publish routes (Plan 02) can use `validate_bearer_token` to authenticate API requests

---
*Phase: 140-package-registry-backend-website*
*Completed: 2026-03-01*
