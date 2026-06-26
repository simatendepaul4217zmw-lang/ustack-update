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

-- CHECK constraints for wallet direction integrity
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='transactions' AND constraint_name='chk_source_wallet'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT chk_source_wallet
        CHECK (source_wallet IS NULL OR source_wallet IN ('main','reserve','external'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='transactions' AND constraint_name='chk_destination_wallet'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT chk_destination_wallet
        CHECK (destination_wallet IS NULL OR destination_wallet IN ('main','reserve','external'));
  END IF;
END $$;

-- Unique index on external_id for idempotency (allows NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS transactions_external_id_idx
  ON transactions(external_id)
  WHERE external_id IS NOT NULL;

-- Audit table for Main <-> Reserve Blink intra-ledger transfers
CREATE TABLE IF NOT EXISTS wallet_transfers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet    TEXT NOT NULL CHECK (from_wallet IN ('main','reserve','external')),
  to_wallet      TEXT NOT NULL CHECK (to_wallet IN ('main','reserve','external')),
  amount_sats    BIGINT NOT NULL,
  reason         TEXT,
  blink_tx_id    TEXT,
  transaction_id UUID REFERENCES transactions(id),
  -- Uniqueness key prevents duplicate Blink transfers for same tx + direction
  UNIQUE (transaction_id, from_wallet, to_wallet),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
