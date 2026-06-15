---
name: Android APK build on Replit
description: How to build a Capacitor Android APK in the Replit sandbox environment
---

## Setup required
- **Java 21** must be downloaded from Adoptium (not Nix — `nixpkgs.jdk21` doesn't exist, only `jdk`, `jdk17`, `jdk11`, etc.)
  - Download: `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.7%2B6/OpenJDK21U-jdk_x64_linux_hotspot_21.0.7_6.tar.gz`
  - Extract to `/home/runner/jdk-21.0.7+6`
  - Set `JAVA_HOME=/home/runner/jdk-21.0.7+6`
- **Android SDK Platform 36** — Capacitor Android sets `compileSdkVersion = 36` in `android/variables.gradle`; must install `platforms;android-36` not `platforms;android-35`
- **Android SDK location**: `/home/runner/android-sdk` — cmdline-tools at `cmdline-tools/latest/`

## Mobile bundle build
- `npm run build:mobile` uses `vite.mobile.config.ts`
- All server-side exports must be explicitly named in the shim plugin (Rollup static analysis requires this)
- Capacitor requires `dist/mobile/index.html` (not `index.mobile.html`) — use a `closeBundle` plugin hook with `import fs from "fs"` (NOT `require("fs")` — config runs as ESM)

## Gradle build
- Capacitor Gradle needs Java 21 source compatibility (`invalid source release: 21` error with Java 17)
- Background processes (`nohup ... &`) do not persist in Replit's sandbox
- Build takes ~2–3 minutes total; the 2-minute tool timeout cuts it off but the APK is written to disk before the timeout triggers
- APK output: `android/app/build/outputs/apk/debug/app-debug.apk` (~4.3 MB)
- Copy to workspace root as `ustack-debug.apk`, then `tar -czf` to make it presentable (`.apk` extension not accepted by present_asset)

**Why:** Replit sandboxes background processes and has a 2-minute bash tool timeout, so the full Gradle compile chain (configuration + compilation + packaging) must run in a single foreground call even when it technically times out — the output file is still written.
