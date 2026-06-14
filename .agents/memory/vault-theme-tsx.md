---
name: vault-theme tsx naming
description: The vault-theme file must use .tsx extension because it exports a JSX component (VaultIcon).
---

The file `src/lib/vault-theme.tsx` exports a `VaultIcon` React component alongside colour maps and icon lists. It **must** be named `.tsx`, not `.ts`.

**Why:** esbuild (used by Vite) rejects JSX syntax in `.ts` files with "Expected '>' but found 'className'". Renaming to `.tsx` fixes this instantly.

**How to apply:** Any file in this codebase that exports JSX must use the `.tsx` extension. Imports using `@/lib/vault-theme` (no extension) resolve correctly to `.tsx` after restart, but if the old `.ts` file still exists Vite will resolve to it first — delete the `.ts` file before the `.tsx` is picked up.
