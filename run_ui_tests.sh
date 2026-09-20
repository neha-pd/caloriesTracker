#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# FitLens — UI Test Runner
#
# Runs all Maestro E2E flows in order against the iOS Simulator.
#
# REQUIREMENTS:
#   1. Backend running:   cd backend && npm run dev
#   2. Mobile running:    cd mobile && npm run start
#   3. iOS Simulator open with Expo Go (press 'i' in the Expo terminal)
#   4. Maestro installed: curl -Ls "https://get.maestro.mobile.dev" | bash
#
# USAGE:
#   chmod +x run_ui_tests.sh
#   ./run_ui_tests.sh
#
#   Run a single flow:
#   ./run_ui_tests.sh 03
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

MAESTRO="${HOME}/.maestro/bin/maestro"
FLOWS_DIR="$(dirname "$0")/mobile/maestro"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

pass=0; fail=0; skip=0
declare -a failed_flows=()

# ── Check Maestro is installed ───────────────────────────────────────────────
if [[ ! -f "$MAESTRO" ]]; then
  echo -e "${RED}✗ Maestro not found at $MAESTRO${RESET}"
  echo "  Install it with: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  exit 1
fi

MAESTRO_VERSION=$("$MAESTRO" --version 2>/dev/null || echo "unknown")
echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  FitLens — UI E2E Test Runner  (Maestro ${MAESTRO_VERSION})${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"

# ── Check simulator is running ───────────────────────────────────────────────
if ! xcrun simctl list devices | grep -q "Booted"; then
  echo -e "${RED}✗ No iOS Simulator is running.${RESET}"
  echo "  Open Xcode → Simulators, or run: open -a Simulator"
  exit 1
fi

echo -e "${GREEN}✔ iOS Simulator detected${RESET}"
echo -e "${GREEN}✔ Maestro found${RESET}\n"

# ── Collect flows ────────────────────────────────────────────────────────────
FILTER="${1:-}"   # optional: pass "03" to run only flow 03

run_flow() {
  local file="$1"
  local name
  name=$(basename "$file" .yaml)

  # If a filter is provided, skip non-matching flows
  if [[ -n "$FILTER" ]] && [[ "$name" != *"$FILTER"* ]]; then
    echo -e "${YELLOW}  ⏭  Skipped: $name${RESET}"
    ((skip++)) || true
    return
  fi

  echo -e "${CYAN}  ▶  Running: $name${RESET}"

  local log_file="/tmp/maestro_${name}.log"

  if "$MAESTRO" test "$file" --format junit --output "/tmp/maestro_${name}.xml" > "$log_file" 2>&1; then
    echo -e "${GREEN}  ✅  Passed:  $name${RESET}"
    ((pass++)) || true
  else
    echo -e "${RED}  ❌  Failed:  $name${RESET}"
    # Show last 10 lines of output for quick diagnosis
    echo -e "${RED}      ── Last output ─────────────────────────────────${RESET}"
    tail -10 "$log_file" | sed 's/^/      /'
    echo -e "${RED}      ─────────────────────────────────────────────────${RESET}"
    failed_flows+=("$name")
    ((fail++)) || true
  fi
  echo ""
}

# ── Run all flows in order ───────────────────────────────────────────────────
for flow in $(ls "$FLOWS_DIR"/*.yaml 2>/dev/null | sort); do
  run_flow "$flow"
done

# ── Summary ──────────────────────────────────────────────────────────────────
total=$((pass + fail))
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  Results: ${GREEN}${pass} passed${RESET}${BOLD} | ${RED}${fail} failed${RESET}${BOLD} | ${YELLOW}${skip} skipped${RESET}${BOLD} (${total} total)${RESET}"

if [[ ${#failed_flows[@]} -gt 0 ]]; then
  echo -e "\n  ${RED}Failed flows:${RESET}"
  for f in "${failed_flows[@]}"; do
    echo -e "    ${RED}•  $f${RESET}"
    echo -e "       Log: /tmp/maestro_${f}.log"
    echo -e "       XML: /tmp/maestro_${f}.xml"
  done
fi

echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"

[[ $fail -eq 0 ]] && exit 0 || exit 1
