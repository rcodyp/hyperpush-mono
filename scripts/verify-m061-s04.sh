#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERIFY_DIR="$ROOT_DIR/.tmp/m061-s04/verify"
STATUS_PATH="$VERIFY_DIR/status.txt"
CURRENT_PHASE_PATH="$VERIFY_DIR/current-phase.txt"
PHASE_REPORT_PATH="$VERIFY_DIR/phase-report.txt"
FULL_CONTRACT_LOG_PATH="$VERIFY_DIR/full-contract.log"
LATEST_PROOF_BUNDLE_PATH="$VERIFY_DIR/latest-proof-bundle.txt"
DELEGATED_VERIFIER="$ROOT_DIR/mesher/scripts/verify-client-route-inventory.sh"
DELEGATED_VERIFY_DIR="$ROOT_DIR/mesher/.tmp/m061-s01/verify-client-route-inventory"
DELEGATED_STATUS_PATH="$DELEGATED_VERIFY_DIR/status.txt"
DELEGATED_CURRENT_PHASE_PATH="$DELEGATED_VERIFY_DIR/current-phase.txt"
DELEGATED_PHASE_REPORT_PATH="$DELEGATED_VERIFY_DIR/phase-report.txt"
DELEGATED_LATEST_PROOF_BUNDLE_PATH="$DELEGATED_VERIFY_DIR/latest-proof-bundle.txt"
PHASE_TIMEOUT_SECONDS="${MESHER_VERIFY_M061_S04_TIMEOUT_SECONDS:-1800}"

readonly ROOT_DIR VERIFY_DIR STATUS_PATH CURRENT_PHASE_PATH PHASE_REPORT_PATH FULL_CONTRACT_LOG_PATH LATEST_PROOF_BUNDLE_PATH
readonly DELEGATED_VERIFIER DELEGATED_VERIFY_DIR DELEGATED_STATUS_PATH DELEGATED_CURRENT_PHASE_PATH DELEGATED_PHASE_REPORT_PATH DELEGATED_LATEST_PROOF_BUNDLE_PATH PHASE_TIMEOUT_SECONDS

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
  echo "verify-m061-s04: ${reason}" >&2
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

require_file() {
  local phase="$1"
  local path="$2"
  local description="$3"
  if [[ -f "$path" ]]; then
    return 0
  fi

  local log_path="$VERIFY_DIR/${phase}.preflight.log"
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

  local log_path="$VERIFY_DIR/${phase}.preflight.log"
  {
    echo "preflight: empty required file"
    echo "description: ${description}"
    echo "path: $(repo_rel "$path")"
  } >"$log_path"
  record_phase "$phase" failed
  fail_phase "$phase" "empty required file: $(repo_rel "$path")" "$log_path"
}

require_phase_marker() {
  local marker="$1"
  if ! grep -Fq -- "$marker" "$DELEGATED_PHASE_REPORT_PATH"; then
    fail_phase delegated-artifacts "delegated verifier phase report drifted: missing ${marker} in $(repo_rel "$DELEGATED_PHASE_REPORT_PATH")" "$VERIFY_DIR/delegated-artifacts.log" "$DELEGATED_PHASE_REPORT_PATH"
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

rm -rf "$VERIFY_DIR"
mkdir -p "$VERIFY_DIR"
exec > >(tee "$FULL_CONTRACT_LOG_PATH") 2>&1

: >"$PHASE_REPORT_PATH"
printf 'running\n' >"$STATUS_PATH"
printf 'init\n' >"$CURRENT_PHASE_PATH"

begin_phase init
require_file init "$DELEGATED_VERIFIER" 'delegated route-inventory verifier'
record_phase init passed

begin_phase delegated-route-inventory
echo '[verify-m061-s04] product-root wrapper delegating to bash mesher/scripts/verify-client-route-inventory.sh'
run_status=0
run_command "$PHASE_TIMEOUT_SECONDS" "$VERIFY_DIR/delegated-route-inventory.log" bash "$DELEGATED_VERIFIER" || run_status=$?
if [[ $run_status -ne 0 ]]; then
  record_phase delegated-route-inventory failed
  if [[ $run_status -eq 124 ]]; then
    fail_phase delegated-route-inventory "timed out after ${PHASE_TIMEOUT_SECONDS}s" "$VERIFY_DIR/delegated-route-inventory.log" "$DELEGATED_VERIFY_DIR"
  fi
  fail_phase delegated-route-inventory 'delegated verifier failed' "$VERIFY_DIR/delegated-route-inventory.log" "$DELEGATED_VERIFY_DIR"
fi
record_phase delegated-route-inventory passed

begin_phase delegated-artifacts
{
  echo 'validating delegated route-inventory artifacts'
  echo "delegated_artifact_dir=$(repo_rel "$DELEGATED_VERIFY_DIR")"
} >"$VERIFY_DIR/delegated-artifacts.log"
for required in \
  "$DELEGATED_STATUS_PATH" \
  "$DELEGATED_CURRENT_PHASE_PATH" \
  "$DELEGATED_PHASE_REPORT_PATH" \
  "$DELEGATED_LATEST_PROOF_BUNDLE_PATH"; do
  require_nonempty_file delegated-artifacts "$required" 'delegated verifier artifact'
done

[[ "$(<"$DELEGATED_STATUS_PATH")" == 'ok' ]] || fail_phase delegated-artifacts "delegated verifier did not finish ok: $(repo_rel "$DELEGATED_STATUS_PATH")=$(<"$DELEGATED_STATUS_PATH")" "$VERIFY_DIR/delegated-artifacts.log"
[[ "$(<"$DELEGATED_CURRENT_PHASE_PATH")" == 'complete' ]] || fail_phase delegated-artifacts "delegated verifier did not finish complete: $(repo_rel "$DELEGATED_CURRENT_PHASE_PATH")=$(<"$DELEGATED_CURRENT_PHASE_PATH")" "$VERIFY_DIR/delegated-artifacts.log"

for expected_phase in \
  $'init\tpassed' \
  $'route-inventory-structure\tpassed' \
  $'seed-live-issue\tpassed' \
  $'seed-live-admin-ops\tpassed' \
  $'route-inventory-dev\tpassed' \
  $'route-inventory-prod\tpassed' \
  $'retained-proof-bundle\tpassed'; do
  require_phase_marker "$expected_phase"
done

DELEGATED_BUNDLE_PATH="$(<"$DELEGATED_LATEST_PROOF_BUNDLE_PATH")"
[[ -n "$DELEGATED_BUNDLE_PATH" ]] || fail_phase delegated-artifacts "delegated verifier latest-proof-bundle pointer was empty: $(repo_rel "$DELEGATED_LATEST_PROOF_BUNDLE_PATH")" "$VERIFY_DIR/delegated-artifacts.log"
[[ -d "$DELEGATED_BUNDLE_PATH" ]] || fail_phase delegated-artifacts "delegated verifier latest-proof-bundle path does not exist: ${DELEGATED_BUNDLE_PATH}" "$VERIFY_DIR/delegated-artifacts.log" "$DELEGATED_VERIFY_DIR"
printf '%s\n' "$DELEGATED_BUNDLE_PATH" >"$LATEST_PROOF_BUNDLE_PATH"
record_phase delegated-artifacts passed

for expected_phase in \
  init \
  delegated-route-inventory \
  delegated-artifacts; do
  if ! grep -Fq -- "${expected_phase}	passed" "$PHASE_REPORT_PATH"; then
    fail_phase final-phase-report "phase report missing passed marker for ${expected_phase}" "$PHASE_REPORT_PATH"
  fi
done

echo 'verify-m061-s04: ok'
echo "artifacts: $(repo_rel "$VERIFY_DIR")"
echo "proof bundle: ${DELEGATED_BUNDLE_PATH}"
