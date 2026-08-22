#!/usr/bin/env bash
# Counts how many times `deno lsp` resolves the SAME npm package folder while
# answering ONE textDocument/documentSymbol request on a 3-line file.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

set_mode() {
  python3 - "$here" "$1" <<'PY'
import json, sys
p = f"{sys.argv[1]}/deno.json"
d = json.load(open(p)); d["nodeModulesDir"] = sys.argv[2]
json.dump(d, open(p, "w"), indent=2); open(p, "a").write("\n")
PY
}

measure() {
  rm -f /tmp/deno-lsp-repro.log
  node "$here/probe.mjs" "$here" "$here/src/main.ts" /tmp/deno-lsp-repro.log documentSymbol >/dev/null 2>&1
  grep -c "Resolved package folder" /tmp/deno-lsp-repro.log 2>/dev/null | tr -d '\n' || true
}

echo "deno: $(deno --version | head -1)"
echo

set_mode auto
rm -rf "$here/node_modules" "$here/deno.lock"
printf 'no node_modules, nodeModulesDir=auto : %s resolutions\n' "$(measure)"

( cd "$here" && deno install >/dev/null 2>&1 )
printf 'node_modules present, auto           : %s resolutions\n' "$(measure)"

set_mode none
printf 'node_modules present, none           : %s resolutions   <-- "none" does not prevent it\n' "$(measure)"

set_mode auto
rm -rf "$here/node_modules" "$here/deno.lock"
printf '\ndeno check, same graph               : '
( cd "$here" && DENO_LOG=debug deno check src/main.ts 2>&1 | grep -c "Resolved package folder" | tr -d '\n' )
printf ' resolutions\n'
rm -f "$here/deno.lock"
