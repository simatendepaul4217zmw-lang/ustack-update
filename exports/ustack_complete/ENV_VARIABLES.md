# UStack — Environment Variables Reference

All variables below must be set for the backend to run correctly.
**Never commit actual values to source control.**

---

## Required Secrets (set in Replit Secrets / .env)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-provided by Replit DB) |
| `JWT_SECRET` | Signs and verifies JWT access tokens (any long random string) |
| `SESSION_SECRET` | Fallback for JWT_SECRET — either one must be set |
| `BLINK_API_KEY` | Blink Lightning API key for BTC wallet operations |
| `BLINK_WALLET_ID` | Your Blink BTC wallet UUID |
| `BLINK_WEBHOOK_SECRET` | Shared secret to verify Blink webhook payloads |
| `LIPILA_API_KEY` | Lipila Mobile Money API key (live credentials) |
| `LIPILA_WEBHOOK_SECRET` | Shared secret to verify Lipila webhook callbacks |
| `RESEND_API_KEY` | Resend email API key for OTP delivery |

## Optional

| Variable | Default | Purpose |
|---|---|---|
| `LIPILA_BASE_URL` | `https://lipila.net` | Override Lipila API base URL (e.g. for sandbox) |
| `NODE_ENV` | `development` | Set to `production` in deployed environments |

---

## Webhook Endpoints to Register

| Service | Endpoint | Where to register |
|---|---|---|
| Lipila (MoMo deposits) | `POST /api/webhooks/lipila` | Lipila merchant dashboard |
| Blink (Lightning) | `POST /api/blink-webhook` | Blink developer dashboard |

---

## Database Tables (13 total)

| Table | Purpose |
|---|---|
| `users` | Registered user accounts (email, username, status) |
| `profiles` | Display names, avatars, PIN hash, biometric settings |
| `sessions` | Refresh token sessions |
| `otp_codes` | One-time passwords for login/signup |
| `wallets` | Per-user available and vault-locked sats balances |
| `vaults` | Savings vaults (goal, type, locked_until, penalty %) |
| `transactions` | All fund movements (deposit/withdrawal/vault, status, method) |
| `activity_logs` | Audit log of user actions |
| `notifications` | In-app notification inbox |
| `btc_prices` | Historical BTC price feed (USD + ZMW) |
| `price_protection` | Per-user price protection preferences |
| `treasury_state` | Lightning treasury mode (BTC/USD) and wallet IDs |
| `treasury_transitions` | History of treasury mode changes |
