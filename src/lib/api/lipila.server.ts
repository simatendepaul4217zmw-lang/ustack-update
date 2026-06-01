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
      key: config.lipilaApiKey,
      amount: req.amountZmw.toFixed(2),
      currency: "ZMW",
      phoneNumber: req.phone,
      accountNumber: req.phone,
      narration: req.narration ?? "UStack Bitcoin deposit",
      externalId: req.externalId,
      fullName: req.fullName,
      email: req.email,
    }),
  });

  const json = await res.json() as {
    status?: string;
    message?: string;
    transactionId?: string;
    externalId?: string;
    error?: string;
  };

  if (!res.ok || json.status === "error") {
    throw new Error(json.message ?? json.error ?? `Lipila request failed (${res.status})`);
  }

  return {
    transactionId: json.transactionId ?? req.externalId,
    externalId: json.externalId ?? req.externalId,
    status: "PENDING",
    message: json.message ?? "Payment request sent — check your phone for the USSD prompt",
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

  const json = await res.json() as {
    status?: string;
    message?: string;
    transactionId?: string;
    externalId?: string;
    error?: string;
  };

  if (!res.ok || json.status === "error") {
    throw new Error(json.message ?? json.error ?? `Lipila disbursement failed (${res.status})`);
  }

  return {
    transactionId: json.transactionId ?? req.externalId,
    externalId: json.externalId ?? req.externalId,
    status: "PENDING",
    message: json.message ?? "Disbursement initiated",
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

  const json = await res.json() as {
    status?: string;
    transactionStatus?: string;
    amount?: number;
    currency?: string;
    phoneNumber?: string;
    accountNumber?: string;
  };

  return {
    transactionId,
    status: (json.transactionStatus ?? json.status ?? "PENDING") as LipilaStatusResult["status"],
    amount: json.amount ?? 0,
    currency: json.currency ?? "ZMW",
    phoneNumber: json.phoneNumber ?? json.accountNumber ?? "",
  };
}
