// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// Packages that use Node.js APIs (Buffer, net, tls) and must never reach the browser.
// When Vite builds the client bundle, any import of these is replaced with a safe empty stub.
const SERVER_ONLY_PACKAGES = [
  "pg",
  "pg-pool",
  "pg-cloudflare",
  "pg-connection-string",
  "postgres-bytea",
  "postgres-date",
  "postgres-interval",
  "jose",
  "bcryptjs",
  "crypto",
];

// .server.ts file paths that must never reach the client bundle
const SERVER_ONLY_FILES = [
  "/src/lib/security.server",
];

function serverOnlyShimPlugin(): Plugin {
  const STUB = `
const noop = () => { throw new Error("Server-only module imported on client"); };
const proxyDefault = new Proxy({}, { get: () => noop });
export default proxyDefault;
// pg
export const Pool = noop;
export const Client = noop;
// jose
export const SignJWT = noop;
export const jwtVerify = noop;
export const jwtDecrypt = noop;
export const decodeJwt = noop;
export const importJWK = noop;
export const createRemoteJWKSet = noop;
// bcryptjs
export const hash = noop;
export const compare = noop;
export const hashSync = noop;
export const compareSync = noop;
export const genSalt = noop;
export const genSaltSync = noop;
// security.server re-exports
export const signTxAuthToken = noop;
export const verifyTxAuthToken = noop;
export const hashPin = noop;
export const verifyPinHash = noop;
`;
  return {
    name: "server-only-shim",
    enforce: "pre",
    resolveId(id, _importer, opts) {
      // opts.ssr is true when building for the server — skip shim then
      if (opts?.ssr) return null;
      if (SERVER_ONLY_PACKAGES.some((pkg) => id === pkg || id.startsWith(pkg + "/"))) {
        return "\0server-only-shim:" + id;
      }
      if (SERVER_ONLY_FILES.some((f) => id.endsWith(f) || id.includes(f))) {
        return "\0server-only-shim:" + id;
      }
      return null;
    },
    load(id) {
      if (id.startsWith("\0server-only-shim:")) {
        return STUB;
      }
      return null;
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server", preset: "node-server" },
    serverFns: { disableCsrfMiddlewareWarning: true },
  },
  vite: {
    plugins: [serverOnlyShimPlugin()],
    server: {
      host: "0.0.0.0",
      port: 5000,
      strictPort: true,
      allowedHosts: true,
      hmr: process.env.REPLIT_DEV_DOMAIN
        ? { host: process.env.REPLIT_DEV_DOMAIN, clientPort: 443, protocol: "wss" }
        : true,
    },
  },
});
