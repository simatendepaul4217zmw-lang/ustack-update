---
name: pg client-side shim
description: Why and how pg (postgres) and other Node.js-only packages must be shimmed out in the Vite client build for TanStack Start.
---

## The Rule
Any package that uses Node.js APIs (`Buffer`, `net`, `tls`, `crypto`) must be intercepted by a custom Vite plugin before it reaches the browser bundle. `optimizeDeps.exclude` and `ssr.external` alone are NOT enough — they change how the package is served but don't prevent it from being requested by the browser.

**Why:** TanStack Start / Vinxi's `createServerFn` is supposed to tree-shake server-side imports from the client bundle, but in practice the full import graph (including `pg`) is still resolved and bundled by Vite unless explicitly intercepted.

**How to apply:** A `serverOnlyShimPlugin()` Vite plugin is defined in `vite.config.ts`. It uses `resolveId` + `load` hooks to return a no-op stub module for any listed package ID when `opts.ssr` is false. When `opts.ssr` is true (server build), the real module is used normally.

The plugin currently stubs: `pg`, `pg-pool`, `pg-cloudflare`, `pg-connection-string`, `postgres-bytea`, `postgres-date`, `postgres-interval`, `jose`, `bcryptjs`, `crypto`.

**Critical: stub must export ALL named exports** — ES module named imports (`import { SignJWT } from "jose"`) cause a hard `SyntaxError` if the stub module doesn't export that name. Add every named export you use from each shimmed package to the stub. A catch-all `Proxy` default export alone is not enough.

**Server-only files (.server.ts)** — files that import shimmed packages must either be excluded from the client build (add their path to `SERVER_ONLY_FILES` in the plugin, matching with `id.includes(path)`) or their named exports must also appear in the STUB. TanStack Start tree-shakes `.handler()` bodies but NOT top-level imports in `*.functions.ts` files.

**The pattern that failed:** `optimizeDeps: { exclude: ['pg'] }` — changes CJS pre-bundling but Vite still serves the raw module; browser then fails with "does not provide an export named 'default'" (CJS ≠ ESM).
