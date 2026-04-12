#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MESHER_ROOT="$ROOT_DIR/mesher"
CLIENT_ROOT="$MESHER_ROOT/client"
ARTIFACT_DIR="$MESHER_ROOT/.tmp/m061-s01/verify-client-route-inventory"
SEED_ARTIFACT_ROOT="$ROOT_DIR/.tmp/m061-s01/verify-client-route-inventory"
PHASE_REPORT_PATH="$ARTIFACT_DIR/phase-report.txt"
STATUS_PATH="$ARTIFACT_DIR/status.txt"
CURRENT_PHASE_PATH="$ARTIFACT_DIR/current-phase.txt"
FULL_CONTRACT_LOG_PATH="$ARTIFACT_DIR/full-contract.log"
LATEST_PROOF_BUNDLE_PATH="$ARTIFACT_DIR/latest-proof-bundle.txt"
RETAINED_PROOF_BUNDLE_DIR="$ARTIFACT_DIR/retained-proof-bundle"
PLAYWRIGHT_ARTIFACT_PATH="$CLIENT_ROOT/test-results"
PHASE_TIMEOUT_SECONDS="${MESHER_VERIFY_ROUTE_INVENTORY_TIMEOUT_SECONDS:-1800}"
ROUTE_GREP='dashboard route parity|issues live|admin and ops live|seeded walkthrough'

readonly ROOT_DIR MESHER_ROOT CLIENT_ROOT ARTIFACT_DIR SEED_ARTIFACT_ROOT PHASE_REPORT_PATH STATUS_PATH CURRENT_PHASE_PATH
readonly FULL_CONTRACT_LOG_PATH LATEST_PROOF_BUNDLE_PATH RETAINED_PROOF_BUNDLE_DIR PLAYWRIGHT_ARTIFACT_PATH PHASE_TIMEOUT_SECONDS ROUTE_GREP

repo_rel() {
  local candidate="$1"
  if [[ "$candidate" == "$ROOT_DIR/"* ]]; then
    printf '%s\n' "${candidate#$ROOT_DIR/}"
  else
    printf '%s\n' "$candidate"
  fi
}

record_phase() {
  printf '%s\t%s\n' "$1" "$2" >>"$PHASE_REPORT_PATH"
}

begin_phase() {
  record_phase "$1" started
  printf '%s\n' "$1" >"$CURRENT_PHASE_PATH"
}

print_log_excerpt() {
  local log_path="$1"
  python3 - "$log_path" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
if not path.exists():
    print(f"missing log: {path}")
    raise SystemExit(0)
lines = path.read_text(errors="replace").splitlines()
for line in lines[:220]:
    print(line)
if len(lines) > 220:
    print(f"... truncated after 220 lines (total {len(lines)})")
PY
}

fail_phase() {
  local phase="$1"
  local reason="$2"
  local log_path="${3:-}"
  local artifact_hint="${4:-}"
  printf 'failed\n' >"$STATUS_PATH"
  printf '%s\n' "$phase" >"$CURRENT_PHASE_PATH"
  echo "verify-client-route-inventory: ${reason}" >&2
  if [[ -n "$artifact_hint" ]]; then
    echo "artifact hint: $(repo_rel "$artifact_hint")" >&2
  fi
  if [[ -n "$log_path" ]]; then
    echo "failing log: $(repo_rel "$log_path")" >&2
    echo "--- $(repo_rel "$log_path") ---" >&2
    print_log_excerpt "$log_path" >&2
  fi
  exit 1
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail_phase init "required command missing from PATH: ${command_name}"
  fi
}

require_file() {
  local phase="$1"
  local path="$2"
  local description="$3"
  if [[ -f "$path" ]]; then
    return 0
  fi

  local log_path="$ARTIFACT_DIR/${phase}.preflight.log"
  {
    echo "preflight: missing required file"
    echo "description: ${description}"
    echo "path: $(repo_rel "$path")"
  } >"$log_path"
  record_phase "$phase" failed
  fail_phase "$phase" "missing required file: $(repo_rel "$path")" "$log_path"
}

require_nonempty_file() {
  local phase="$1"
  local path="$2"
  local description="$3"
  require_file "$phase" "$path" "$description"

  if [[ -s "$path" ]]; then
    return 0
  fi

  local log_path="$ARTIFACT_DIR/${phase}.preflight.log"
  {
    echo "preflight: empty required file"
    echo "description: ${description}"
    echo "path: $(repo_rel "$path")"
  } >"$log_path"
  record_phase "$phase" failed
  fail_phase "$phase" "empty required file: $(repo_rel "$path")" "$log_path"
}

copy_retained_artifact() {
  local source_path="$1"
  local destination_name="$2"
  local destination_path="$RETAINED_PROOF_BUNDLE_DIR/$destination_name"

  mkdir -p "$(dirname "$destination_path")"
  if [[ -d "$source_path" ]]; then
    cp -R "$source_path" "$destination_path"
  else
    cp "$source_path" "$destination_path"
  fi
}

assert_retained_bundle_shape() {
  local phase="$1"
  local bundle_root="$2"
  local pointer_path="$3"
  local log_path="$ARTIFACT_DIR/${phase}.bundle-check.log"

  if ! python3 - "$bundle_root" "$pointer_path" >"$log_path" 2>&1 <<'PY'
from pathlib import Path
import sys

bundle_root = Path(sys.argv[1])
pointer_path = Path(sys.argv[2])
expected_pointer = str(bundle_root)
actual_pointer = pointer_path.read_text(errors='replace').strip()
if actual_pointer != expected_pointer:
    raise SystemExit(
        f'latest-proof-bundle pointer drifted: expected {expected_pointer!r}, got {actual_pointer!r}'
    )

required_files = [
    'full-contract.log',
    'phase-report.txt',
    'status.txt',
    'current-phase.txt',
    'route-inventory-structure.log',
    'seed-live-issue.log',
    'seed-live-admin-ops.log',
    'route-inventory-dev.log',
    'route-inventory-prod.log',
    'route-inventory-dev.validation.log',
    'route-inventory-prod.validation.log',
    'proof-inputs/mesher.scripts.verify-client-route-inventory.sh',
    'proof-inputs/mesher.scripts.tests.verify-client-route-inventory.test.mjs',
    'proof-inputs/client.ROUTE-INVENTORY.md',
    'proof-inputs/client.README.md',
    'proof-inputs/client.package.json',
    'proof-inputs/client.playwright.config.ts',
    'proof-inputs/proof-inputs.meta.json',
]
for relative in required_files:
    if not (bundle_root / relative).exists():
        raise SystemExit(f"{bundle_root}: missing required retained file {relative}")

print('retained proof bundle: ok')
PY
  then
    fail_phase "$phase" "retained proof bundle pointer or artifact shape drifted" "$log_path" "$bundle_root"
  fi
}

run_command() {
  local timeout_secs="$1"
  local log_path="$2"
  shift 2
  local -a cmd=("$@")
  {
    printf '$'
    printf ' %q' "${cmd[@]}"
    printf '\n'
    "${cmd[@]}"
  } >"$log_path" 2>&1 &
  local cmd_pid=$!
  local deadline=$((SECONDS + timeout_secs))
  while kill -0 "$cmd_pid" 2>/dev/null; do
    if (( SECONDS >= deadline )); then
      echo "command timed out after ${timeout_secs}s" >>"$log_path"
      kill -TERM "$cmd_pid" 2>/dev/null || true
      sleep 1
      kill -KILL "$cmd_pid" 2>/dev/null || true
      wait "$cmd_pid" 2>/dev/null || true
      return 124
    fi
    sleep 1
  done
  wait "$cmd_pid"
}

assert_playwright_filter_ran() {
  local phase="$1"
  local log_path="$2"
  local label="$3"
  local validation_log="$ARTIFACT_DIR/${label}.validation.log"

  if ! python3 - "$log_path" <<'PY' >"$validation_log" 2>&1
from pathlib import Path
import re
import sys

text = Path(sys.argv[1]).read_text(errors="replace")
text = re.sub(r"\x1b\[[0-9;]*m", "", text)
required_files = [
    'dashboard-route-parity.spec.ts',
    'issues-live-read.spec.ts',
    'issues-live-actions.spec.ts',
    'admin-ops-live.spec.ts',
    'seeded-walkthrough.spec.ts',
]

if 'No tests found' in text:
    raise SystemExit('playwright reported no tests found for the route inventory grep')

for pattern in [r'\bRunning\s+0\s+tests?\b', r'\bTotal:\s+0\s+tests?\b']:
    if re.search(pattern, text, flags=re.IGNORECASE):
        raise SystemExit('playwright reported zero matched tests for the route inventory grep')

listed = {name: 0 for name in required_files}
executed = {name: 0 for name in required_files}
for raw_line in text.splitlines():
    line = raw_line.strip()
    if not line:
        continue
    for name in required_files:
        if name not in line:
            continue
        listed[name] += 1
        if not re.match(r'^[-–]', line):
            executed[name] += 1

missing = [name for name, count in listed.items() if count == 0]
if missing:
    raise SystemExit('missing matched proof suite output for: ' + ', '.join(missing))

skipped_only = [name for name in required_files if listed[name] > 0 and executed[name] == 0]
if skipped_only:
    raise SystemExit('matched proof suite output was skipped-only for: ' + ', '.join(skipped_only))

print('playwright proof coverage: ok')
for name in required_files:
    print(f'{name}: listed={listed[name]} executed={executed[name]}')
PY
  then
    fail_phase "$phase" "named Playwright proof rail drifted, matched zero tests, or skipped required suites" "$validation_log" "$PLAYWRIGHT_ARTIFACT_PATH"
  fi
}

run_expect_success() {
  local phase="$1"
  local label="$2"
  local timeout_secs="$3"
  local artifact_hint="$4"
  local validator="${5:-}"
  shift 5
  local -a cmd=("$@")
  local log_path="$ARTIFACT_DIR/${label}.log"

  begin_phase "$phase"
  echo "==> ${cmd[*]}"

  local run_status=0
  run_command "$timeout_secs" "$log_path" "${cmd[@]}" || run_status=$?
  if [[ $run_status -ne 0 ]]; then
    record_phase "$phase" failed
    if [[ $run_status -eq 124 ]]; then
      fail_phase "$phase" "timed out after ${timeout_secs}s" "$log_path" "$artifact_hint"
    fi
    fail_phase "$phase" "expected success within ${timeout_secs}s" "$log_path" "$artifact_hint"
  fi

  if [[ -n "$validator" ]]; then
    "$validator" "$phase" "$log_path" "$label"
  fi

  record_phase "$phase" passed
}

on_exit() {
  local exit_code=$?
  if [[ $exit_code -eq 0 ]]; then
    printf 'ok\n' >"$STATUS_PATH"
    printf 'complete\n' >"$CURRENT_PHASE_PATH"
  elif [[ ! -f "$STATUS_PATH" || "$(<"$STATUS_PATH")" != 'failed' ]]; then
    printf 'failed\n' >"$STATUS_PATH"
  fi
}
trap on_exit EXIT

rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"
exec > >(tee "$FULL_CONTRACT_LOG_PATH") 2>&1

: >"$PHASE_REPORT_PATH"
printf 'running\n' >"$STATUS_PATH"
printf 'init\n' >"$CURRENT_PHASE_PATH"

begin_phase init
for command_name in bash node npm python3; do
  require_command "$command_name"
done
for path in \
  "$MESHER_ROOT/scripts/tests/verify-client-route-inventory.test.mjs" \
  "$MESHER_ROOT/scripts/seed-live-issue.sh" \
  "$MESHER_ROOT/scripts/seed-live-admin-ops.sh" \
  "$MESHER_ROOT/scripts/verify-client-route-inventory.sh" \
  "$CLIENT_ROOT/package.json" \
  "$CLIENT_ROOT/README.md" \
  "$CLIENT_ROOT/ROUTE-INVENTORY.md" \
  "$CLIENT_ROOT/tests/e2e/dashboard-route-parity.spec.ts" \
  "$CLIENT_ROOT/tests/e2e/issues-live-read.spec.ts" \
  "$CLIENT_ROOT/tests/e2e/issues-live-actions.spec.ts" \
  "$CLIENT_ROOT/tests/e2e/admin-ops-live.spec.ts" \
  "$CLIENT_ROOT/tests/e2e/seeded-walkthrough.spec.ts"; do
  require_file init "$path" "route inventory verification input"
done
record_phase init passed

run_expect_success \
  route-inventory-structure \
  route-inventory-structure \
  "$PHASE_TIMEOUT_SECONDS" \
  "$MESHER_ROOT/scripts/tests/verify-client-route-inventory.test.mjs" \
  '' \
  node --test "$MESHER_ROOT/scripts/tests/verify-client-route-inventory.test.mjs"

run_expect_success \
  seed-live-issue \
  seed-live-issue \
  "$PHASE_TIMEOUT_SECONDS" \
  "$SEED_ARTIFACT_ROOT/seed-live-issue" \
  '' \
  env DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/mesher}" \
    BASE_URL="http://127.0.0.1:18280" \
    PORT=18280 \
    MESHER_SEED_ARTIFACT_DIR="$SEED_ARTIFACT_ROOT/seed-live-issue" \
    bash "$MESHER_ROOT/scripts/seed-live-issue.sh"

run_expect_success \
  seed-live-admin-ops \
  seed-live-admin-ops \
  "$PHASE_TIMEOUT_SECONDS" \
  "$SEED_ARTIFACT_ROOT/seed-live-admin-ops" \
  '' \
  env MESHER_SEED_ARTIFACT_DIR="$SEED_ARTIFACT_ROOT/seed-live-admin-ops" bash "$MESHER_ROOT/scripts/seed-live-admin-ops.sh"

run_expect_success \
  route-inventory-dev \
  route-inventory-dev \
  "$PHASE_TIMEOUT_SECONDS" \
  "$PLAYWRIGHT_ARTIFACT_PATH" \
  assert_playwright_filter_ran \
  env PLAYWRIGHT_PROJECT=dev npm --prefix "$CLIENT_ROOT" exec -- playwright test --config "$CLIENT_ROOT/playwright.config.ts" --project=dev --grep "$ROUTE_GREP"

run_expect_success \
  route-inventory-prod \
  route-inventory-prod \
  "$PHASE_TIMEOUT_SECONDS" \
  "$PLAYWRIGHT_ARTIFACT_PATH" \
  assert_playwright_filter_ran \
  env PLAYWRIGHT_PROJECT=prod npm --prefix "$CLIENT_ROOT" exec -- playwright test --config "$CLIENT_ROOT/playwright.config.ts" --project=prod --grep "$ROUTE_GREP"

begin_phase retained-proof-bundle
rm -rf "$RETAINED_PROOF_BUNDLE_DIR"
mkdir -p "$RETAINED_PROOF_BUNDLE_DIR/proof-inputs"
copy_retained_artifact "$FULL_CONTRACT_LOG_PATH" full-contract.log
copy_retained_artifact "$PHASE_REPORT_PATH" phase-report.txt
copy_retained_artifact "$STATUS_PATH" status.txt
copy_retained_artifact "$CURRENT_PHASE_PATH" current-phase.txt
copy_retained_artifact "$ARTIFACT_DIR/route-inventory-structure.log" route-inventory-structure.log
copy_retained_artifact "$ARTIFACT_DIR/seed-live-issue.log" seed-live-issue.log
copy_retained_artifact "$ARTIFACT_DIR/seed-live-admin-ops.log" seed-live-admin-ops.log
copy_retained_artifact "$ARTIFACT_DIR/route-inventory-dev.log" route-inventory-dev.log
copy_retained_artifact "$ARTIFACT_DIR/route-inventory-prod.log" route-inventory-prod.log
copy_retained_artifact "$ARTIFACT_DIR/route-inventory-dev.validation.log" route-inventory-dev.validation.log
copy_retained_artifact "$ARTIFACT_DIR/route-inventory-prod.validation.log" route-inventory-prod.validation.log
copy_retained_artifact "$MESHER_ROOT/scripts/verify-client-route-inventory.sh" proof-inputs/mesher.scripts.verify-client-route-inventory.sh
copy_retained_artifact "$MESHER_ROOT/scripts/tests/verify-client-route-inventory.test.mjs" proof-inputs/mesher.scripts.tests.verify-client-route-inventory.test.mjs
copy_retained_artifact "$CLIENT_ROOT/ROUTE-INVENTORY.md" proof-inputs/client.ROUTE-INVENTORY.md
copy_retained_artifact "$CLIENT_ROOT/README.md" proof-inputs/client.README.md
copy_retained_artifact "$CLIENT_ROOT/package.json" proof-inputs/client.package.json
copy_retained_artifact "$CLIENT_ROOT/playwright.config.ts" proof-inputs/client.playwright.config.ts
python3 - "$RETAINED_PROOF_BUNDLE_DIR/proof-inputs/proof-inputs.meta.json" "$PLAYWRIGHT_ARTIFACT_PATH" "$SEED_ARTIFACT_ROOT/seed-live-issue" "$SEED_ARTIFACT_ROOT/seed-live-admin-ops" <<'PY'
from pathlib import Path
import json
import sys

Path(sys.argv[1]).write_text(
    json.dumps(
        {
            "playwright_artifacts": sys.argv[2],
            "seed_live_issue_artifacts": sys.argv[3],
            "seed_live_admin_ops_artifacts": sys.argv[4],
        },
        indent=2,
    )
    + "\n"
)
PY
printf '%s\n' "$RETAINED_PROOF_BUNDLE_DIR" >"$LATEST_PROOF_BUNDLE_PATH"
assert_retained_bundle_shape retained-proof-bundle "$RETAINED_PROOF_BUNDLE_DIR" "$LATEST_PROOF_BUNDLE_PATH"
record_phase retained-proof-bundle passed

for expected_phase in \
  init \
  route-inventory-structure \
  seed-live-issue \
  seed-live-admin-ops \
  route-inventory-dev \
  route-inventory-prod \
  retained-proof-bundle; do
  if ! grep -Fq -- "${expected_phase}	passed" "$PHASE_REPORT_PATH"; then
    fail_phase final-phase-report "phase report missing passed marker for ${expected_phase}" "$PHASE_REPORT_PATH"
  fi
done

echo 'verify-client-route-inventory: ok'
echo "artifacts: $(repo_rel "$ARTIFACT_DIR")"
echo "phase report: $(repo_rel "$PHASE_REPORT_PATH")"
echo "proof bundle: $(repo_rel "$RETAINED_PROOF_BUNDLE_DIR")"
