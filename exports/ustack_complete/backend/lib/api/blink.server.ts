import { getServerConfig } from "../config.server";
import { creditWallet } from "./wallet.functions";
import { execute, queryOne } from "../db/index.server";

export interface Invoice {
  paymentRequest: string;
  paymentHash: string;
  amountSats: number;
  expiresAt: string;
  mock?: boolean;
}

// Module-level wallet ID cache (survives across requests within the same process)
let _cachedWalletId: string | null = null;

async function getBlinkWalletId(config: ReturnType<typeof getServerConfig>): Promise<string> {
  if (config.blinkWalletId) return config.blinkWalletId;
  if (_cachedWalletId) return _cachedWalletId;

  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.blinkApiKey!,
    },
    body: JSON.stringify({
      query: `query Me { me { defaultAccount { wallets { id walletCurrency } } } }`,
    }),
  });

  const json = await res.json() as {
    data?: { me?: { defaultAccount?: { wallets?: { id: string; walletCurrency: string }[] } } };
    errors?: { message: string }[];
  };

  if (json.errors?.length) throw new Error(json.errors[0].message);

  const wallets = json.data?.me?.defaultAccount?.wallets ?? [];
  const btcWallet = wallets.find((w) => w.walletCurrency === "BTC");
  if (!btcWallet) throw new Error("No BTC wallet found in Blink account");

  _cachedWalletId = btcWallet.id;
  return btcWallet.id;
}

// Fetch the live Blink BTC wallet balance (in sats)
export async function getBlinkBalance(): Promise<number> {
  const config = getServerConfig();
  if (config.mockBlink) return 0;

  const walletId = await getBlinkWalletId(config);

  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.blinkApiKey!,
    },
    body: JSON.stringify({
      query: `query AccountDetails {
        me {
          defaultAccount {
            wallets {
              id
              walletCurrency
              balance
            }
          }
        }
      }`,
    }),
  });

  const json = await res.json() as {
    data?: { me?: { defaultAccount?: { wallets?: { id: string; balance: number }[] } } };
  };

  const wallets = json.data?.me?.defaultAccount?.wallets ?? [];
  const wallet = wallets.find((w) => w.id === walletId);
  return wallet?.balance ?? 0;
}

// Create a Lightning invoice (Blink or mock)
export async function createLightningInvoice(
  userId: string,
  amountSats: number,
  memo?: string,
  vaultId?: string
): Promise<Invoice> {
  const config = getServerConfig();

  if (config.mockBlink) {
    const mockHash = `mock_${Date.now()}_${userId.slice(0, 8)}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await execute(
      `INSERT INTO transactions(user_id, type, amount_sats, status, method, lightning_invoice, lightning_payment_hash, vault_id)
       VALUES($1,'deposit',$2,'pending','lightning',$3,$4,$5)`,
      [userId, amountSats, `lnbc_mock_${mockHash}`, mockHash, vaultId ?? null]
    );

    return {
      paymentRequest: `lnbc${amountSats}n1p_mock_invoice_${mockHash}`,
      paymentHash: mockHash,
      amountSats,
      expiresAt,
      mock: true,
    };
  }

  // Always create invoices on the BTC wallet — Lightning invoices are always in sats.
  // Treasury mode (BTC vs USD) controls internal fund storage after receipt, not invoice creation.
  const walletId = await getBlinkWalletId(config);

  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.blinkApiKey!,
    },
    body: JSON.stringify({
      query: `mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
        lnInvoiceCreate(input: $input) {
          invoice { paymentRequest paymentHash satoshis }
          errors { message }
        }
      }`,
      variables: {
        input: { walletId, amount: amountSats, memo: memo ?? "UStack deposit" },
      },
    }),
  });

  const json = await res.json() as {
    data?: { lnInvoiceCreate?: { invoice?: { paymentRequest: string; paymentHash: string; satoshis: number; expiresAt: string }; errors?: { message: string }[] } };
    errors?: { message: string }[];
  };
  const result = json.data?.lnInvoiceCreate;
  if (!result?.invoice) {
    const msg =
      result?.errors?.[0]?.message ??
      json.errors?.[0]?.message ??
      `HTTP ${res.status}: Failed to create invoice`;
    throw new Error(msg);
  }

  await execute(
    `INSERT INTO transactions(user_id, type, amount_sats, status, method, lightning_invoice, lightning_payment_hash, vault_id)
     VALUES($1,'deposit',$2,'pending','lightning',$3,$4,$5)`,
    [userId, amountSats, result.invoice.paymentRequest, result.invoice.paymentHash, vaultId ?? null]
  );

  return {
    paymentRequest: result.invoice.paymentRequest,
    paymentHash: result.invoice.paymentHash,
    amountSats,
    expiresAt: result.invoice.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    mock: false,
  };
}

// Pay a Lightning invoice (withdraw via Blink or mock)
export async function payLightningInvoice(
  userId: string,
  paymentRequest: string,
  amountSats: number
): Promise<{ success: boolean; status: "SUCCESS" | "PENDING"; paymentHash?: string }> {
  const config = getServerConfig();

  if (config.mockBlink) {
    const hash = `mock_pay_${Date.now()}`;
    await execute(
      `INSERT INTO transactions(user_id, type, amount_sats, status, method, lightning_invoice, lightning_payment_hash)
       VALUES($1,'withdraw',$2,'confirmed','lightning',$3,$4)`,
      [userId, amountSats, paymentRequest, hash]
    );
    return { success: true, status: "SUCCESS", paymentHash: hash };
  }

  const walletId = await getBlinkWalletId(config);

  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.blinkApiKey!,
    },
    body: JSON.stringify({
      query: `mutation LnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
        lnInvoicePaymentSend(input: $input) {
          status
          errors { message }
          transaction { id settlementAmount }
        }
      }`,
      variables: {
        input: { walletId, paymentRequest },
      },
    }),
  });

  const json = await res.json() as {
    data?: {
      lnInvoicePaymentSend?: {
        status: string;
        errors?: { message: string }[];
        transaction?: { id: string; settlementAmount: number };
      };
    };
    errors?: { message: string }[];
  };

  console.log("[blink] lnInvoicePaymentSend response:", JSON.stringify(json));

  const result = json.data?.lnInvoicePaymentSend;

  if (!result || result.status === "FAILURE" || result.status === "ALREADY_PAID") {
    const msg =
      result?.errors?.[0]?.message ??
      json.errors?.[0]?.message ??
      `Payment failed (status: ${result?.status ?? "unknown"})`;
    throw new Error(msg);
  }

  // SUCCESS or PENDING — both mean the payment was accepted
  const txStatus = result.status === "SUCCESS" ? "confirmed" : "pending";
  const paymentHash = result.transaction?.id ?? `blink_${Date.now()}`;

  await execute(
    `INSERT INTO transactions(user_id, type, amount_sats, status, method, lightning_invoice, lightning_payment_hash)
     VALUES($1,'withdraw',$2,$3,'lightning',$4,$5)`,
    [userId, amountSats, txStatus, paymentRequest, paymentHash]
  );

  return { success: true, status: result.status === "SUCCESS" ? "SUCCESS" : "PENDING", paymentHash };
}

// Pay a Lightning Address (user@domain.com) via Blink
export async function payLightningAddress(
  userId: string,
  lnAddress: string,
  amountSats: number
): Promise<{ success: boolean; status: "SUCCESS" | "PENDING" }> {
  const config = getServerConfig();

  if (config.mockBlink) {
    const hash = `mock_lnaddr_${Date.now()}`;
    await execute(
      `INSERT INTO transactions(user_id, type, amount_sats, status, method, lightning_invoice, lightning_payment_hash)
       VALUES($1,'withdraw',$2,'confirmed','lightning',$3,$4)`,
      [userId, amountSats, lnAddress, hash]
    );
    return { success: true, status: "SUCCESS" };
  }

  const walletId = await getBlinkWalletId(config);

  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.blinkApiKey!,
    },
    body: JSON.stringify({
      query: `mutation LnAddressPaymentSend($input: LnAddressPaymentInput!) {
        lnAddressPaymentSend(input: $input) {
          status
          errors { message }
        }
      }`,
      variables: {
        input: { walletId, lnAddress, amount: amountSats, memo: "UStack withdrawal" },
      },
    }),
  });

  const json = await res.json() as {
    data?: { lnAddressPaymentSend?: { status: string; errors?: { message: string }[] } };
    errors?: { message: string }[];
  };

  console.log("[blink] lnAddressPaymentSend response:", JSON.stringify(json));

  const result = json.data?.lnAddressPaymentSend;
  if (!result || result.status === "FAILURE") {
    const msg =
      result?.errors?.[0]?.message ??
      json.errors?.[0]?.message ??
      "Lightning address payment failed";
    throw new Error(msg);
  }

  const txStatus = result.status === "SUCCESS" ? "confirmed" : "pending";
  await execute(
    `INSERT INTO transactions(user_id, type, amount_sats, status, method, lightning_invoice, lightning_payment_hash)
     VALUES($1,'withdraw',$2,$3,'lightning',$4,$5)`,
    [userId, amountSats, txStatus, lnAddress, `lnaddr_${Date.now()}`]
  );

  return { success: true, status: result.status === "SUCCESS" ? "SUCCESS" : "PENDING" };
}

// Query Blink directly for invoice payment status
export async function getLightningInvoiceStatus(
  paymentRequest: string
): Promise<"PENDING" | "PAID" | "EXPIRED"> {
  const config = getServerConfig();
  if (config.mockBlink) return "PENDING";

  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.blinkApiKey!,
    },
    body: JSON.stringify({
      query: `query LnInvoicePaymentStatus($input: LnInvoicePaymentStatusInput!) {
        lnInvoicePaymentStatus(input: $input) {
          status
          errors { message }
        }
      }`,
      variables: { input: { paymentRequest } },
    }),
  });

  const json = await res.json() as {
    data?: { lnInvoicePaymentStatus?: { status: string; errors?: { message: string }[] } };
    errors?: { message: string }[];
  };

  console.log("[blink] lnInvoicePaymentStatus raw response:", JSON.stringify(json));

  if (json.errors?.length) {
    console.error("[blink] lnInvoicePaymentStatus API error:", json.errors[0].message);
    return "PENDING";
  }

  const payload = json.data?.lnInvoicePaymentStatus;
  if (payload?.errors?.length) {
    console.error("[blink] lnInvoicePaymentStatus field error:", payload.errors[0].message);
    return "PENDING";
  }

  const status = payload?.status ?? "PENDING";
  console.log("[blink] invoice status:", status);
  if (status === "PAID") return "PAID";
  if (status === "EXPIRED") return "EXPIRED";
  return "PENDING";
}

// Get estimated on-chain fee for a send (sats)
export async function getOnChainFee(
  address: string,
  amountSats: number
): Promise<number> {
  const config = getServerConfig();
  if (config.mockBlink) return 500; // mock fee

  const walletId = config.blinkWalletId;
  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": config.blinkApiKey! },
    body: JSON.stringify({
      query: `query OnChainTxFee($walletId: WalletId!, $address: OnChainAddress!, $amount: SatAmount!) {
        onChainTxFee(walletId: $walletId, address: $address, amount: $amount) { amount }
      }`,
      variables: { walletId, address, amount: amountSats },
    }),
  });
  const json = await res.json();
  return json?.data?.onChainTxFee?.amount ?? 0;
}

// Send sats to a Bitcoin on-chain address
export async function payOnChain(
  userId: string,
  address: string,
  amountSats: number
): Promise<{ success: boolean; status: "SUCCESS" | "PENDING" }> {
  const config = getServerConfig();

  // Record transaction row
  const txStatus = config.mockBlink ? "confirmed" : "pending";
  await execute(
    `INSERT INTO transactions(user_id, type, amount_sats, currency, status, meta)
     VALUES($1,'withdraw',$2,'BTC',$3,$4)`,
    [userId, amountSats, txStatus, JSON.stringify({ channel: "onchain", address })]
  );

  if (config.mockBlink) return { success: true, status: "SUCCESS" };

  const walletId = config.blinkWalletId;
  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": config.blinkApiKey! },
    body: JSON.stringify({
      query: `mutation OnChainPaymentSend($input: OnChainPaymentSendInput!) {
        onChainPaymentSend(input: $input) {
          status
          errors { message }
        }
      }`,
      variables: { input: { walletId, address, amount: amountSats } },
    }),
  });
  const json = await res.json();
  const result = json?.data?.onChainPaymentSend;
  const errors = result?.errors;

  if (errors?.length) throw new Error(errors[0].message);

  const status = result?.status;
  console.log("[payOnChain] Blink response:", JSON.stringify(result));

  if (status === "FAILURE") throw new Error("On-chain payment failed");

  await execute(
    `UPDATE transactions SET status=$1, updated_at=NOW()
     WHERE user_id=$2 AND type='withdraw' AND meta->>'channel'='onchain' AND meta->>'address'=$3
     ORDER BY created_at DESC LIMIT 1`,
    [status === "SUCCESS" ? "confirmed" : "pending", userId, address]
  );

  return { success: true, status: status === "SUCCESS" ? "SUCCESS" : "PENDING" };
}

// Confirm a mock invoice payment (dev/testing tool)
export async function confirmMockPayment(paymentHash: string): Promise<void> {
  const tx = await queryOne<{ user_id: string; amount_sats: string }>(
    `SELECT user_id, amount_sats FROM transactions WHERE lightning_payment_hash=$1 AND status='pending'`,
    [paymentHash]
  );
  if (!tx) throw new Error("Transaction not found or already confirmed");

  await execute(`UPDATE transactions SET status='confirmed', updated_at=NOW() WHERE lightning_payment_hash=$1`, [paymentHash]);
  await creditWallet(tx.user_id, Number(tx.amount_sats));
}
