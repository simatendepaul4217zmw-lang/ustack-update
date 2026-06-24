# UStack — Google Play Store Submission Checklist

## App Identity
- [ ] **App name**: UStack – Bitcoin Savings
- [ ] **Short description** (≤80 chars): Save Bitcoin in sats. Built for Zambian students.
- [ ] **Full description** (≤4000 chars):
  ```
  UStack helps Zambian students save money in Bitcoin (satoshis).

  Features:
  • Create savings vaults with flexible or time-locked goals
  • Lightning Network deposits — stack sats instantly
  • Real-time Bitcoin price in ZMW
  • Activity log and transaction history
  • Secure PIN and biometric authentication (coming soon)

  Built for students in Zambia who want to save in a currency that doesn't lose value.
  ```

## Store Listing Assets
- [ ] **App icon**: 512×512 PNG (no alpha, no rounded corners — Play adds rounding)
- [ ] **Feature graphic**: 1024×500 PNG/JPEG — shown at top of listing
- [ ] **Screenshots** (minimum 2, up to 8 per device type):
  - Phone (16:9 or 9:16): Welcome screen, Dashboard, Vault screen, Activity log
  - Tablet (optional but recommended for ranking)

## Categorisation
- [ ] **Category**: Finance
- [ ] **Tags**: bitcoin, savings, zambia, students, lightning

## Content Rating
- [ ] Complete the content rating questionnaire
  - Not a game
  - No user-generated content
  - Financial / money management app
  - Expected rating: **Everyone** or **Teen**

## Privacy & Legal
- [ ] **Privacy Policy URL** — required for finance apps. Host at e.g.:
  `https://ustack.replit.app/privacy`  (create a `/privacy` route returning a policy page)
- [ ] **Data safety form** — declare:
  - Email address collected (account)
  - Financial info: account balance (not shared with third parties)
  - No data sold to third parties

## App Bundle
- [x] **AAB signed**: `ustack-release.aab` (3.2 MB)
- [x] **Keystore**: `android/app/ustack-release.jks` — **back this up securely**
- [x] **Keystore alias**: `ustack-release`
- [ ] **Target API level**: 36 ✅ (meets Play's current requirement of API 34+)
- [ ] **versionCode** and **versionName** set in `android/app/build.gradle`

## Release Track
- [ ] Start with **Internal testing** (upload AAB, share with up to 100 testers via email)
- [ ] Promote to **Closed testing** (alpha) after internal QA
- [ ] Promote to **Open testing** (beta) for broader feedback
- [ ] Promote to **Production** when ready for public release

## Play App Signing
Google Play re-signs your AAB with their own key for delivery. On first upload:
- Play will ask you to opt in to **Play App Signing** (recommended — Google holds the signing key)
- Upload your `ustack-release.aab` — Play extracts the signing certificate automatically
- **Keep `ustack-release.jks` safe** — you need it for future uploads and the Play Console will verify it

## Pre-launch Checklist
- [ ] Test APK/AAB on a real device before upload
- [ ] Verify Lightning invoice flow works end-to-end
- [ ] Verify vault lock/unlock flow
- [ ] Check that no test/debug data appears in the app
- [ ] Confirm `capacitor.config.ts` `server.url` is NOT pointing to localhost

## Build Commands (for future releases)
```bash
# 1. Bump versionCode in android/app/build.gradle
# 2. Build web bundle
npm run build:mobile

# 3. Sync Capacitor
npx cap sync android

# 4. Build signed AAB
cd android
./gradlew bundleRelease

# AAB output: android/app/build/outputs/bundle/release/app-release.aab
```
