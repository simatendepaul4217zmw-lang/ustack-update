import { getServerConfig } from "../config.server";

export interface LipilaPaymentRequest {
  phone: string;
  amountZmw: number;
  externalId: string;
  narration?: string;
  fullName?: string;
  email?: string;
}

export interface LipilaTransactionResult {
  transactionId: string;
  externalId: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  message: string;
}

export interface LipilaStatusResult {
  transactionId: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  amount: number;
  currency: string;
  phoneNumber: string;
}

// Request a mobile money collection (customer pays us)
export async function requestPayment(req: LipilaPaymentRequest): Promise<LipilaTransactionResult> {
  const config = getServerConfig();

  const res = await fetch(`${config.lipilaBaseUrl}/api/v1/payments/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.lipilaApiKey}`,
    },
    body: JSON.stringify({
      amount: Number(req.amountZmw.toFixed(2)),
      currency: "ZMW",
      phoneNumber: req.phone.replace(/^\+/, ""),
      accountNumber: req.phone.replace(/^\+/, ""),
      narration: req.narration ?? "UStack Bitcoin deposit",
      externalId: req.externalId,
      fullName: req.fullName,
      email: req.email,
    }),
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) as {
    status?: string;
    message?: string;
    transactionId?: string;
    externalId?: string;
    error?: string;
  } : {};

  if (!res.ok || (json as { status?: string }).status === "error") {
    throw new Error((json as { message?: string; error?: string }).message ?? (json as { error?: string }).error ?? `Lipila request failed (${res.status})`);
  }

  return {
    transactionId: (json as { transactionId?: string }).transactionId ?? req.externalId,
    externalId: (json as { externalId?: string }).externalId ?? req.externalId,
    status: "PENDING",
    message: (json as { message?: string }).message ?? "Payment request sent — check your phone for the USSD prompt",
  };
}

// Disburse funds to a mobile money account (we pay customer)
export async function disburseFunds(req: LipilaPaymentRequest): Promise<LipilaTransactionResult> {
  const config = getServerConfig();

  const res = await fetch(`${config.lipilaBaseUrl}/transactions/mobile-money/disburse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.lipilaApiKey}`,
    },
    body: JSON.stringify({
      currency: "ZMW",
      amount: req.amountZmw,
      accountNumber: req.phone,
      phoneNumber: req.phone,
      fullName: req.fullName,
      email: req.email,
      externalId: req.externalId,
      narration: req.narration ?? "UStack payout",
    }),
  });

  const text2 = await res.text();
  const json2 = text2 ? JSON.parse(text2) as {
    status?: string;
    message?: string;
    transactionId?: string;
    externalId?: string;
    error?: string;
  } : {};

  if (!res.ok || (json2 as { status?: string }).status === "error") {
    throw new Error((json2 as { message?: string }).message ?? (json2 as { error?: string }).error ?? `Lipila disbursement failed (${res.status})`);
  }

  return {
    transactionId: (json2 as { transactionId?: string }).transactionId ?? req.externalId,
    externalId: (json2 as { externalId?: string }).externalId ?? req.externalId,
    status: "PENDING",
    message: (json2 as { message?: string }).message ?? "Disbursement initiated",
  };
}

// Poll a transaction status by transactionId
export async function getLipilaStatus(transactionId: string): Promise<LipilaStatusResult> {
  const config = getServerConfig();

  const res = await fetch(`${config.lipilaBaseUrl}/api/v1/transactions/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${config.lipilaApiKey}`,
    },
  });

  const text3 = await res.text();
  const json = text3 ? JSON.parse(text3) as {
    status?: string;
    transactionStatus?: string;
    amount?: number;
    currency?: string;
    phoneNumber?: string;
    accountNumber?: string;
  } : {};

  return {
    transactionId,
    status: (json.transactionStatus ?? json.status ?? "PENDING") as LipilaStatusResult["status"],
    amount: json.amount ?? 0,
    currency: json.currency ?? "ZMW",
    phoneNumber: json.phoneNumber ?? json.accountNumber ?? "",
  };
}
