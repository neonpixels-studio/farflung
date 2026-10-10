#!/usr/bin/env bash
# Dependency vulnerability gate for CI.
# Runs `npm audit`, prints a severity summary, and fails the build when there is
# at least one high or critical *advisory* that is not on the accepted allowlist
# below. Moderate and low are reported but never fail the build.
# Dev dependencies are intentionally in scope: build/test tooling runs in CI
# and on developer machines, so its advisories matter here.
#
# Blocking is measured per distinct advisory (GHSA id), not per affected package.
# npm's package-level counts inflate a single root advisory into every package
# that pulls it in transitively (e.g. one image-size flaw counts image-size,
# @netlify/dev-utils, and @netlify/blobs). Counting advisories keeps the gate
# honest about how many real, un-remediated flaws exist.
#
# ALLOWLIST POLICY: only advisories with no upstream fix belong here, each with a
# justification and a trigger to remove it. This is NOT a way to silence fixable
# findings — prefer an npm `overrides` bump every time one is available.
set -euo pipefail

# High/critical advisories accepted because no patched version exists upstream.
# Remove an entry the moment its package ships a fix and bump via `overrides`.
#
# GHSA-86w9-cpqp-85rv (node-forge <=1.4.0, RSA PKCS#1 v1.5 signature
#   verification accepts malformed DigestInfo). No patched release as of Oct
#   2026. Pulled in by @dotenvx/dotenvx and nuxt > @nuxt/cli > listhen, which
#   only use forge to generate local dev/proxy certificates and never call
#   signature verification. Remove once node-forge ships >1.4.0.
# GHSA-vfj7-8cjw-p6xm (braces <=3.0.3, stack-exhaustion DoS on deeply nested
#   patterns). No patched release as of Oct 2026. Pulled in by nuxt >
#   nitropack > globby > fast-glob > micromatch, which only expands build-time
#   glob patterns authored in this repo, never user input. Remove once braces
#   ships >3.0.3.
# GHSA-858h-whjf-mvg5, GHSA-g4wm-2vf7-vfgr, GHSA-x6jw-m9v5-85vh (simple-git
#   <4.0.1 command execution) and GHSA-v5rq-49vh-5v5c (@simple-git/argv-parser
#   <2.0.1). A fix exists in simple-git 4, but @nuxt/devtools 3.x imports its
#   removed default export, so upgrading crashes nuxt build/dev/vitest, and
#   disabling devtools is not acceptable. Only @nuxt/devtools uses simple-git,
#   under `nuxt dev` on a local checkout (dev-only, never in the production
#   bundle). Mirrors markpost 60a4c2f / basin #338. Remove once @nuxt/devtools
#   supports simple-git 4.
ALLOWLISTED_ADVISORIES=(
  GHSA-86w9-cpqp-85rv
  GHSA-vfj7-8cjw-p6xm
  GHSA-858h-whjf-mvg5
  GHSA-g4wm-2vf7-vfgr
  GHSA-x6jw-m9v5-85vh
  GHSA-v5rq-49vh-5v5c
)

report="$(npm audit --json || true)"

if ! printf '%s' "$report" | jq -e '.metadata.vulnerabilities' >/dev/null 2>&1; then
  echo "npm audit produced no vulnerability metadata (audit failed) — failing the build." >&2
  exit 1
fi

read_count() {
  local severity="$1"
  printf '%s' "$report" | jq -r --arg severity "$severity" \
    '.metadata.vulnerabilities[$severity] // 0'
}

critical="$(read_count critical)"
high="$(read_count high)"
moderate="$(read_count moderate)"
low="$(read_count low)"

{
  echo "## Dependency audit"
  echo ""
  echo "| Severity | Affected packages |"
  echo "| -------- | ----------------- |"
  echo "| Critical | ${critical} |"
  echo "| High     | ${high} |"
  echo "| Moderate | ${moderate} |"
  echo "| Low      | ${low} |"
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

# Reads a JSON string on stdin through jq so each id pipeline is a single call.
jq_on() {
  printf '%s' "$1" | jq "${@:2}"
}

# Build the allowlist as a JSON array — safe even when the array is emptied
# (removing every entry is the documented next step once fixes ship).
allow_json="$(jq -cn '$ARGS.positional' --args ${ALLOWLISTED_ADVISORIES[@]+"${ALLOWLISTED_ADVISORIES[@]}"})"

# Distinct high/critical advisory ids in the report: the GHSA id when the
# advisory carries one, otherwise a source-<n>:<pkg> fallback that stays unique
# so two url-less advisories never collapse. `(.via // [])` tolerates a
# vulnerability object without a `via` array instead of aborting under set -e.
all_ids="$(jq_on "$report" -c '
  [ .vulnerabilities[]
    | (.via // [])[]
    | select(type == "object" and (.severity == "high" or .severity == "critical"))
    | (((.url // "") | capture("(?<id>GHSA-[-0-9a-z]+)").id)? )
      // ("source-" + ((.source // 0) | tostring) + ":" + (.name // .title // "unknown"))
  ] | unique')"

# NOTE on staleness: there is no reliable per-advisory "patched upstream" signal
# in `npm audit --json` — `fixAvailable` is per-package, and its value covers
# breaking tree-surgery (e.g. downgrading a parent) as readily as a clean patch.
# So removal is manual: this gate re-runs `npm audit` every CI run, keeping the
# data fresh; when a maintainer next touches deps and sees image-size (or its
# consumer) ship a real fix, drop the entry above and bump it via `overrides`.
# The warning below flags entries that have already fallen out of the report.
blocking_ids="$(jq_on "$all_ids" -c --argjson allow "$allow_json" 'map(select(IN($allow[]) | not))')"
blocking_count="$(jq_on "$blocking_ids" 'length')"

accepted_ids="$(jq_on "$all_ids" -c --argjson allow "$allow_json" 'map(select(IN($allow[])))')"
accepted_present="$(jq_on "$accepted_ids" 'length')"

stale_ids="$(jq_on "$all_ids" -r --argjson allow "$allow_json" '$allow - . | .[]')"
if [ -n "$stale_ids" ]; then
  echo "Allowlist entries no longer present in the audit — safe to remove from ALLOWLISTED_ADVISORIES:" >&2
  printf '%s\n' "$stale_ids" >&2
fi

if [ "$accepted_present" -gt 0 ]; then
  {
    echo ""
    echo "Accepted (allowlisted, no upstream fix) high/critical advisories:"
    jq_on "$accepted_ids" -r '.[] | "- " + .'
  } | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
fi

if [ "$blocking_count" -gt 0 ]; then
  {
    echo ""
    echo "Found ${blocking_count} un-allowlisted high/critical advisories — failing the build:"
    jq_on "$blocking_ids" -r '.[] | "- " + .'
  } | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}" >&2
  exit 1
fi

echo "No un-allowlisted high or critical advisories found."
