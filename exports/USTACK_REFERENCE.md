# UStack — Full Offline Reference
**Generated:** 24 June 2026  
**Stack:** TanStack Start · React 19 · PostgreSQL · Tailwind CSS 4 · Capacitor (Android)

---

## 1. DATABASE — All 13 Tables

### `users`
Core account record. One row per user.
```
id                uuid          PK, default gen_random_uuid()
username          varchar(50)   UNIQUE, NOT NULL
email             varchar(255)
account_status    varchar(20)   default 'active'
created_at        timestamptz   default now()
updated_at        timestamptz   default now()
```

### `profiles`
Extended user info, security settings, PIN.
```
id                        uuid          PK
user_id                   uuid          FK → users.id (CASCADE)
display_name              varchar(100)
avatar_initials           varchar(5)
avatar_color              varchar(20)   default 'btc'
profile_picture_url       text
biometric_enabled         boolean       default false
notification_preferences  jsonb         default '{}'
transaction_pin_hash      text          bcrypt hash of 4-digit PIN
transaction_pin_enabled   boolean       default false, NOT NULL
transaction_pin_created_at timestamptz
transaction_pin_updated_at timestamptz
failed_pin_attempts       integer       default 0, NOT NULL
transaction_lock_until    timestamptz   set after 5 failed PIN attempts
created_at                timestamptz
updated_at                timestamptz
```

### `wallets`
One wallet per user. Holds sats balance.
```
id              uuid    PK
user_id         uuid    FK → users.id (CASCADE), UNIQUE
available_sats  bigint  default 0   (sats free to use)
vault_sats      bigint  default 0   (sats locked in vaults)
created_at      timestamptz
updated_at      timestamptz
```

### `vaults`
Savings buckets. Each user can have many.
```
id                    uuid        PK
user_id               uuid        FK → users.id (CASCADE)
name                  varchar(50) NOT NULL
vault_type            varchar(10) CHECK IN ('stack', 'hodl')
emoji                 varchar(10) default '💰'
accent                varchar(10) default 'btc'
goal_sats             bigint      default 0
current_sats          bigint      default 0
goal_fiat             numeric(18,2) default 0
currency              varchar(10) default 'ZMW'
locked_until          timestamptz   (hodl vaults only)
withdrawal_penalty_pct integer    default 0
status                varchar(20) default 'active'
streak_days           integer     default 0
last_deposit_at       timestamptz
created_at            timestamptz
updated_at            timestamptz
```

### `transactions`
Every deposit, withdrawal, and vault move.
```
id                     uuid        PK
user_id                uuid        FK → users.id (CASCADE)
vault_id               uuid        FK → vaults.id (SET NULL)
type                   varchar(30) e.g. 'deposit', 'withdrawal', 'vault_deposit', 'vault_withdrawal'
amount_sats            bigint      default 0, NOT NULL
status                 varchar(20) default 'pending' → 'confirmed'/'failed'
method                 varchar(30) e.g. 'lightning', 'momo_airtel', 'momo_mtn', 'momo_zamtel'
metadata               jsonb       extra data (phone, provider, lipila IDs, etc.)
external_id            text        Lipila externalId or Blink payment hash
lightning_invoice      text        BOLT11 invoice string
lightning_payment_hash text        indexed for webhook lookup
created_at             timestamptz
updated_at             timestamptz
```

### `sessions`
JWT refresh tokens. One row per active device/session.
```
id             uuid   PK
user_id        uuid   FK → users.id (CASCADE)
refresh_token  text   UNIQUE
expires_at     timestamptz  (30 days)
created_at     timestamptz
```

### `otp_codes`
Email OTP for login and signup. Deleted after use.
```
id          uuid         PK
email       varchar(255) indexed
code        varchar(6)   6-digit numeric
expires_at  timestamptz  5 minutes from creation
used        boolean      default false
created_at  timestamptz
```

### `notifications`
In-app notification bell items.
```
id          uuid        PK
user_id     uuid        FK → users.id (CASCADE)
kind        varchar(30) e.g. 'deposit_confirmed', 'price_drop', 'vault_goal'
title       text        NOT NULL
body        text
unread      boolean     default true
created_at  timestamptz
```

### `activity_logs`
Audit trail of user actions.
```
id          uuid        PK
user_id     uuid        FK → users.id (CASCADE)
action      varchar(50) e.g. 'deposit', 'withdraw', 'vault_created'
title       text
meta        text
created_at  timestamptz
```

### `btc_prices`
BTC price history fetched every 60 seconds from CoinGecko.
```
id          integer (serial)  PK
price_usd   numeric(18,2)
price_zmw   numeric(18,2)
fetched_at  timestamptz  default now(), indexed DESC
```

### `price_protection`
Per-user price protection setting (auto-convert to USD if BTC drops).
```
id            uuid        PK
user_id       uuid        FK → users.id (CASCADE), UNIQUE
enabled       boolean     default false
threshold_pct integer     default 20
asset_state   varchar(20) default 'btc'  ('btc' or 'usd')
created_at    timestamptz
updated_at    timestamptz
```

### `treasury_state`
Single-row platform treasury (tracks BTC/USD mode).
```
id                    integer (serial)  PK  (always 1 row)
current_mode          text    default 'btc'  ('btc' or 'usd')
reference_price_usd   numeric
protection_price_usd  numeric
pending_action        text    ('convert_to_usd' | 'convert_to_btc' | null)
pending_started_at    timestamptz
last_transition_at    timestamptz
last_transition_price numeric
btc_wallet_id         text    Blink BTC wallet ID
usd_wallet_id         text    Blink USD wallet ID
created_at            timestamptz
updated_at            timestamptz
```

### `treasury_transitions`
Log of every treasury mode switch.
```
id              integer (serial)  PK
from_mode       text  NOT NULL
to_mode         text  NOT NULL
trigger_price   numeric  NOT NULL  (price that triggered the switch)
reference_price numeric  NOT NULL
blink_tx_id     text     (Blink transaction ID if one was made)
created_at      timestamptz
```

---

## 2. DATABASE INDEXES

| Index | Table | Column |
|---|---|---|
| idx_activity_user | activity_logs | user_id |
| idx_btc_prices_fetched | btc_prices | fetched_at DESC |
| idx_notifications_user | notifications | user_id |
| idx_otp_email | otp_codes | email |
| idx_sessions_refresh | sessions | refresh_token |
| idx_transactions_user | transactions | user_id |
| idx_txn_payment_hash | transactions | lightning_payment_hash |
| idx_vaults_user | vaults | user_id |
| idx_wallets_user | wallets | user_id |

---

## 3. ENVIRONMENT VARIABLES — All Required Keys

| Variable | What it is | Required? |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Replit managed) | ✅ Always |
| `JWT_SECRET` | Signs JWT access tokens (short-lived, 15min) | ✅ Always |
| `SESSION_SECRET` | Fallback if JWT_SECRET not set (same purpose) | ✅ Always |
| `BLINK_API_KEY` | Blink Lightning API key — from dashboard.blink.sv | ✅ For live Lightning |
| `BLINK_WALLET_ID` | Blink BTC wallet ID — optional (auto-fetched if missing) | ⚠️ Optional |
| `BLINK_WEBHOOK_SECRET` | HMAC-SHA256 secret to verify Blink webhook signatures | ✅ For live Lightning |
| `LIPILA_API_KEY` | Lipila Mobile Money API key — from blaze.lipila.dev | ✅ For live MoMo |
| `LIPILA_WEBHOOK_SECRET` | Shared secret to verify Lipila webhook signatures | ✅ For live MoMo |
| `LIPILA_BASE_URL` | Lipila API base URL | ⚠️ Optional (defaults to https://blaze.lipila.dev) |
| `RESEND_API_KEY` | Resend email API key — for sending OTP emails | ✅ Always |

**Mock mode:** If `BLINK_API_KEY` is not set → Blink runs in mock mode (no real Lightning). If `LIPILA_API_KEY` is not set → Lipila runs in mock mode (no real MoMo).

---

## 4. EXTERNAL APIs IN USE

### Blink (Lightning Bitcoin)
- **Purpose:** Create Lightning invoices (deposits), send Lightning payments (withdrawals), track treasury BTC balance
- **API URL:** `https://api.blink.sv/graphql` (GraphQL)
- **Auth:** `X-API-KEY: <BLINK_API_KEY>` header
- **Dashboard:** https://dashboard.blink.sv
- **What the app calls:**
  - `Me` query → get wallet IDs
  - `lnInvoiceCreateOnBehalfOfRecipient` → create deposit invoice
  - `lnInvoicePaymentSend` → send Lightning withdrawal
  - `AccountDetails` query → get live wallet balance

### Lipila (Zambian Mobile Money)
- **Purpose:** Accept ZMW from users via Airtel Money / MTN MoMo / Zamtel Kwacha, then payout withdrawals
- **API URL:** `https://blaze.lipila.dev` (REST)
- **Auth:** `Authorization: Bearer <LIPILA_API_KEY>` + `key` in body
- **Dashboard:** https://blaze.lipila.dev
- **What the app calls:**
  - `POST /api/v1/payments/request` → collect ZMW from customer (deposit)
  - `POST /api/v1/payments/disburse` → send ZMW to customer (withdrawal)
  - `GET /api/v1/payments/status/{transactionId}` → poll payment status

### CoinGecko (BTC Price)
- **Purpose:** Fetch live BTC/USD and BTC/ZMW price every 60 seconds
- **API URL:** `https://api.coingecko.com/api/v3`
- **Auth:** None (free public tier)
- **Endpoint used:** `GET /simple/price?ids=bitcoin&vs_currencies=usd,zmw`
- **No API key needed**

### Resend (Email)
- **Purpose:** Send OTP verification emails to users during signup and login
- **API URL:** Resend SDK (npm package `resend`)
- **Auth:** `RESEND_API_KEY`
- **Dashboard:** https://resend.com
- **From address:** `UStack <onboarding@ustack.site>`
- **Email sent:** 6-digit OTP code, expires in 5 minutes

---

## 5. WEBHOOK ENDPOINTS

### Blink Webhook (Lightning deposits incoming)
| | |
|---|---|
| **Route** | `POST /api/blink-webhook` |
| **Trigger** | Blink calls this when a Lightning payment is received into the platform wallet |
| **Verification** | HMAC-SHA256 of raw body using `BLINK_WEBHOOK_SECRET` — checked via `timingSafeEqual` |
| **What it does** | Matches `lightning_payment_hash` in `transactions` table → marks status `confirmed` → credits user wallet |
| **Register at** | https://dashboard.blink.sv → Webhooks → add your domain + `/api/blink-webhook` |
| **Health check** | `GET /api/blink-webhook` → `{ ok: true, service: "UStack Blink webhook" }` |

### Lipila Webhook (Mobile Money payment status)
| | |
|---|---|
| **Primary route** | `POST /api/webhooks/lipila` |
| **Legacy route** | `POST /api/lipila-webhook` (same handler, kept for compatibility) |
| **Trigger** | Lipila calls this when a MoMo collection or disbursement completes or fails |
| **Verification** | Checks `LIPILA_WEBHOOK_SECRET` from request headers |
| **What it does** | Matches `external_id` in `transactions` table → marks status `confirmed`/`failed` → credits/reverses user wallet |
| **Register at** | https://blaze.lipila.dev → Dashboard → Webhook URL → set to `https://yourdomain.replit.app/api/webhooks/lipila` |
| **Health check** | `GET /api/webhooks/lipila` → `{ ok: true, service: "UStack Lipila webhook" }` |

---

## 6. INTERNAL API ROUTES (read-only, no auth)

| Route | Method | What it returns |
|---|---|---|
| `/api/treasury-status` | GET | Current treasury mode, BTC/USD prices, drop %, pending action |
| `/api/treasury-history` | GET | Last 20 treasury BTC↔USD transitions |

---

## 7. AUTH FLOW SUMMARY

```
New user:
  Enter username + email → POST /api/auth/request-otp
  Enter 6-digit code     → POST /api/auth/verify-otp-signup
  Account created → JWT access token (15min) + refresh token (30 days) stored

Returning user:
  Enter email            → POST /api/auth/request-otp
  Enter 6-digit code     → POST /api/auth/verify-otp
  Logged in → JWT access token (15min) + refresh token (30 days)

After login (day-to-day):
  Access token refreshed silently using refresh token
  OTP never asked again unless user logs out or 30-day session expires

PIN / Biometric:
  Used only to AUTHORIZE withdrawals and to UNLOCK the app
  Set up in Settings → Security
  Stored as bcrypt hash in profiles.transaction_pin_hash
  5 failed attempts → account locked for a timed period
```

---

## 8. DATABASE FILE

The full PostgreSQL dump (schema + all data) is in this same folder:
**`ustack_database_dump.sql`**

To restore on any PostgreSQL server:
```bash
psql <your-database-url> < ustack_database_dump.sql
```
