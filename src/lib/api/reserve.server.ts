import { getServerConfig } from "../config.server";
import { execute, queryOne, withTransaction } from "../db/index.server";

const BLINK_API_URL = "https://api.blink.sv/graphql";

async function blinkFetch(apiKey: string, body: object) {
  const res = await fetch(BLINK_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{
    data?: Record<string, unknown>;
    errors?: { message: string }[];
  }>;
}

export async function getReserveBalance(): Promise<number> {
  const config = getServerConfig();
  if (config.mockReserveBlink) return 0;

  const json = await blinkFetch(config.reserveBlinkApiKey!, {
    query: `query Me { me { defaultAccount { wallets { id walletCurrency balance } } } }`,
  });

  const wallets = (json.data?.me as { defaultAccount?: { wallets?: { id: string; walletCurrency: string; balance: number }[] } })?.defaultAccount?.wallets ?? [];
  const btc = wallets.find((w) => w.walletCurrency === "BTC");
  return btc?.balance ?? 0;
}

export async function getMainBalance(): Promise<number> {
  const config = getServerConfig();
  if (config.mockBlink) return 0;

  const json = await blinkFetch(config.blinkApiKey!, {
    query: `query Me { me { defaultAccount { wallets { id walletCurrency balance } } } }`,
  });

  const wallets = (json.data?.me as { defaultAccount?: { wallets?: { id: string; walletCurrency: string; balance: number }[] } })?.defaultAccount?.wallets ?? [];
  const btc = wallets.find((w) => w.walletCurrency === "BTC");
  return btc?.balance ?? 0;
}

async function checkAndAlertLowReserve(reserveSats: number): Promise<void> {
  const config = getServerConfig();
  if (reserveSats >= config.reserveMinimumBalance) return;

  console.warn(`[reserve] ⚠️ Low reserve alert: ${reserveSats} sats < ${config.reserveMinimumBalance} minimum`);

  await execute(
    `INSERT INTO activity_logs(user_id, action, title, meta)
     VALUES (NULL, 'low_reserve_alert', 'Reserve Wallet Low', $1)`,
    [JSON.stringify({ reserve_sats: reserveSats, minimum_balance: config.reserveMinimumBalance })]
  );

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM notifications WHERE kind='low_reserve' AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`
  );
  if (!existing) {
    await execute(
      `INSERT INTO notifications(user_id, kind, title, body)
       SELECT id, 'low_reserve', 'Reserve Wallet Low', $1 FROM users WHERE role='admin' LIMIT 1`,
      [`Reserve balance is ${reserveSats.toLocaleString()} sats, below the ${config.reserveMinimumBalance.toLocaleString()} sats minimum. Please top up the reserve wallet.`]
    );
  }
}

export async function transferReserveToMain(
  amountSats: number,
  reason: string,
  transactionId?: string,
  exchangeRateZmw?: number | null,
  exchangeRateUsd?: number | null
): Promise<string> {
  const config = getServerConfig();

  if (config.mockReserveBlink) {
    console.log(`[reserve] MOCK: transferReserveToMain ${amountSats} sats — ${reason}`);
    await execute(
      `INSERT INTO wallet_transfers(from_wallet, to_wallet, amount_sats, reason, blink_tx_id, transaction_id)
       VALUES('reserve','main',$1,$2,'mock-reserve-to-main',$3)`,
      [amountSats, reason, transactionId ?? null]
    );
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta)
       VALUES(NULL,'wallet_transfer','Reserve → Main Transfer',$1)`,
      [JSON.stringify({ from_wallet: 'reserve', to_wallet: 'main', amount_sats: amountSats, reason, exchange_rate_zmw: exchangeRateZmw, exchange_rate_usd: exchangeRateUsd, mock: true })]
    );
    return "mock-reserve-to-main";
  }

  // Idempotency: if a wallet_transfer already exists for this tx + direction, skip Blink call
  if (transactionId) {
    const existing = await queryOne<{ blink_tx_id: string }>(
      `SELECT blink_tx_id FROM wallet_transfers
       WHERE transaction_id=$1 AND from_wallet='reserve' AND to_wallet='main' LIMIT 1`,
      [transactionId]
    );
    if (existing) {
      console.log(`[reserve] Reserve→Main already executed for tx ${transactionId} — skipping duplicate`);
      return existing.blink_tx_id;
    }
  }

  const reserveApiKey = config.reserveBlinkApiKey!;
  const reserveWalletId = config.reserveBlinkWalletId!;
  const mainWalletId = config.blinkWalletId!;

  console.log(`[reserve] Transferring ${amountSats} sats Reserve→Main: ${reason}`);

  const json = await blinkFetch(reserveApiKey, {
    query: `mutation IntraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {
      intraLedgerPaymentSend(input: $input) {
        status errors { message } transaction { id }
      }
    }`,
    variables: {
      input: {
        walletId: reserveWalletId,
        recipientWalletId: mainWalletId,
        amount: amountSats,
        memo: `UStack MoMo deposit: ${reason}`,
      },
    },
  });

  const result = (json.data?.intraLedgerPaymentSend as { status: string; errors?: { message: string }[]; transaction?: { id: string } } | undefined);
  if (!result || result.status === "FAILURE") {
    const msg = result?.errors?.[0]?.message ?? json.errors?.[0]?.message ?? "Reserve→Main transfer failed";
    throw new Error(msg);
  }

  const blinkTxId = result.transaction?.id ?? `reserve-to-main-${Date.now()}`;

  await execute(
    `INSERT INTO wallet_transfers(from_wallet, to_wallet, amount_sats, reason, blink_tx_id, transaction_id)
     VALUES('reserve','main',$1,$2,$3,$4)`,
    [amountSats, reason, blinkTxId, transactionId ?? null]
  );

  await execute(
    `INSERT INTO activity_logs(user_id, action, title, meta)
     VALUES(NULL,'wallet_transfer','Reserve → Main Transfer',$1)`,
    [JSON.stringify({ from_wallet: 'reserve', to_wallet: 'main', amount_sats: amountSats, reason, blink_tx_id: blinkTxId, exchange_rate_zmw: exchangeRateZmw, exchange_rate_usd: exchangeRateUsd })]
  );

  const newBalance = await getReserveBalance();
  await checkAndAlertLowReserve(newBalance);

  console.log(`[reserve] ✅ Reserve→Main complete. Blink TX: ${blinkTxId}. Reserve balance: ${newBalance} sats`);
  return blinkTxId;
}

export async function transferMainToReserve(
  amountSats: number,
  reason: string,
  transactionId?: string,
  exchangeRateZmw?: number | null,
  exchangeRateUsd?: number | null
): Promise<string> {
  const config = getServerConfig();

  if (config.mockReserveBlink) {
    console.log(`[reserve] MOCK: transferMainToReserve ${amountSats} sats — ${reason}`);
    await execute(
      `INSERT INTO wallet_transfers(from_wallet, to_wallet, amount_sats, reason, blink_tx_id, transaction_id)
       VALUES('main','reserve',$1,$2,'mock-main-to-reserve',$3)`,
      [amountSats, reason, transactionId ?? null]
    );
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta)
       VALUES(NULL,'wallet_transfer','Main → Reserve Transfer',$1)`,
      [JSON.stringify({ from_wallet: 'main', to_wallet: 'reserve', amount_sats: amountSats, reason, exchange_rate_zmw: exchangeRateZmw, exchange_rate_usd: exchangeRateUsd, mock: true })]
    );
    return "mock-main-to-reserve";
  }

  // Idempotency: if a wallet_transfer already exists for this tx + direction, skip Blink call
  if (transactionId) {
    const existing = await queryOne<{ blink_tx_id: string }>(
      `SELECT blink_tx_id FROM wallet_transfers
       WHERE transaction_id=$1 AND from_wallet='main' AND to_wallet='reserve' LIMIT 1`,
      [transactionId]
    );
    if (existing) {
      console.log(`[reserve] Main→Reserve already executed for tx ${transactionId} — skipping duplicate`);
      return existing.blink_tx_id;
    }
  }

  const mainApiKey = config.blinkApiKey!;
  const mainWalletId = config.blinkWalletId!;
  const reserveWalletId = config.reserveBlinkWalletId!;

  console.log(`[reserve] Transferring ${amountSats} sats Main→Reserve: ${reason}`);

  const json = await blinkFetch(mainApiKey, {
    query: `mutation IntraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {
      intraLedgerPaymentSend(input: $input) {
        status errors { message } transaction { id }
      }
    }`,
    variables: {
      input: {
        walletId: mainWalletId,
        recipientWalletId: reserveWalletId,
        amount: amountSats,
        memo: `UStack MoMo withdrawal: ${reason}`,
      },
    },
  });

  const result = (json.data?.intraLedgerPaymentSend as { status: string; errors?: { message: string }[]; transaction?: { id: string } } | undefined);
  if (!result || result.status === "FAILURE") {
    const msg = result?.errors?.[0]?.message ?? json.errors?.[0]?.message ?? "Main→Reserve transfer failed";
    throw new Error(msg);
  }

  const blinkTxId = result.transaction?.id ?? `main-to-reserve-${Date.now()}`;

  await execute(
    `INSERT INTO wallet_transfers(from_wallet, to_wallet, amount_sats, reason, blink_tx_id, transaction_id)
     VALUES('main','reserve',$1,$2,$3,$4)`,
    [amountSats, reason, blinkTxId, transactionId ?? null]
  );

  await execute(
    `INSERT INTO activity_logs(user_id, action, title, meta)
     VALUES(NULL,'wallet_transfer','Main → Reserve Transfer',$1)`,
    [JSON.stringify({ from_wallet: 'main', to_wallet: 'reserve', amount_sats: amountSats, reason, blink_tx_id: blinkTxId, exchange_rate_zmw: exchangeRateZmw, exchange_rate_usd: exchangeRateUsd })]
  );

  console.log(`[reserve] ✅ Main→Reserve complete. Blink TX: ${blinkTxId}`);
  return blinkTxId;
}
