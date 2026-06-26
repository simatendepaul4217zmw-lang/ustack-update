-- Migration: Dual-wallet treasury support
-- Adds source_wallet, destination_wallet, exchange_rate columns to transactions,
-- external_id for idempotency, and the wallet_transfers audit table.

-- Add wallet direction columns to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source_wallet TEXT,
  ADD COLUMN IF NOT EXISTS destination_wallet TEXT,
  ADD COLUMN IF NOT EXISTS exchange_rate_zmw NUMERIC,
  ADD COLUMN IF NOT EXISTS exchange_rate_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Unique index on external_id for idempotency (allows NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS transactions_external_id_idx
  ON transactions(external_id)
  WHERE external_id IS NOT NULL;

-- Audit table for Main <-> Reserve Blink intra-ledger transfers
CREATE TABLE IF NOT EXISTS wallet_transfers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet    TEXT NOT NULL,
  to_wallet      TEXT NOT NULL,
  amount_sats    BIGINT NOT NULL,
  reason         TEXT,
  blink_tx_id    TEXT,
  transaction_id UUID REFERENCES transactions(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
