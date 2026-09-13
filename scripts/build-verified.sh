#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v timeout || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

css_file="${SITES_PROJECT_ROOT}/app/globals.css"
if [[ -f "${css_file}" ]] && [[ "$(tail -n 1 "${css_file}")" == '\n' ]]; then
  echo "Removing stray literal \\n from app/globals.css before build..."
  css_tmp="${css_file}.tmp"
  sed '$d' "${css_file}" > "${css_tmp}"
  mv "${css_tmp}" "${css_file}"
fi

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build
