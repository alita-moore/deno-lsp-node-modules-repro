# `deno lsp` re-resolves the same npm package folder hundreds of times when `node_modules` exists

**TL;DR** — With an identical module graph, `deno lsp` resolves the *same* npm package
folder **744 times instead of 0** when a local `node_modules` directory is present. Setting
`"nodeModulesDir": "none"` does not prevent it. `deno check` on the same graph does not
exhibit it.

On a real monorepo this makes the language server unusable: a single
`textDocument/definition` takes **37 seconds** and logs **296,037** package-folder
resolutions, 51,584 of them for one package.

## Reproduce

```
git clone <this repo> && cd deno-lsp-node-modules-repro
./run.sh
```

Output on `deno 2.9.5 (stable, aarch64-unknown-linux-gnu)`:

```
no node_modules, nodeModulesDir=auto : 0 resolutions
node_modules present, auto           : 744 resolutions
node_modules present, none           : 744 resolutions   <-- "none" does not prevent it

deno check, same graph               : 0 resolutions
```

## What the repro contains

Five files. A workspace with two members, each importing one npm package, and a
three-line entrypoint that imports both.

```
deno.json     { "workspace": ["./a","./b"], "nodeModulesDir": "auto" }
a/deno.json   { "name":"@repro/a", "exports":"./mod.ts", "imports":{"jose":"npm:jose@5.10.0"} }
b/deno.json   same, package @repro/b
a/mod.ts      import { SignJWT } from "jose";            (2 lines)
b/mod.ts      same                                       (2 lines)
src/main.ts   imports both members                       (3 lines)
```

`probe.mjs` (34 lines, no dependencies) drives `deno lsp` over stdio: `initialize`,
`didOpen`, then **one** `textDocument/documentSymbol`. It answers the server's
`workspace/configuration` requests, which is required or the server blocks.

The count comes from `DENO_LOG=debug`, counting lines matching
`Resolved package folder`.

## Why the language server specifically

`deno check` over the same graph resolves each package folder once. The amplification
appears only through the LSP, so it is not the resolver in general.

Measured properties:

- **Per graph build, not per request.** Three consecutive `documentSymbol` calls cost
  the same as one; the 2nd and 3rd return in ~1 ms.
- **Independent of request kind.** `definition`, `documentSymbol`, and either order,
  all produce the same count.
- **Independent of package version count.** Two versions of the same package split the
  same total rather than adding to it.
- **Scales with the `node_modules` tree.** 70 directories → ~1,116 resolutions here;
  a 5.4 GB tree across 60 nested `node_modules` → 296,037.

## Ruled out

`byonm`, `sloppy-imports`, npm workspaces declared in `package.json`, nested
`deno.json` files, and `deno.enablePaths` scope. Each was measured; none changes the
count materially.

## Environment

- deno 2.9.5 (stable, release, aarch64-unknown-linux-gnu), v8 15.0.245.2-rusty
- Linux (devcontainer), Node 22 for the probe
