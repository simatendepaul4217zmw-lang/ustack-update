import { getServerConfig } from "../config.server";

// Lipila API base URLs (verified June 2026)
// Collections (deposits):  https://blz.lipila.io  — auth: X-API-Key header
// Reporting (status):      https://api.lipila.io  — auth: Authorization: Bearer
const COLLECTION_BASE = "https://blz.lipila.io";
const REPORTING_BASE  = "https://api.lipila.io";

export interface LipilaPaymentRequest {
  phone: string;
  amountZmw: number;
  externalId: string;
  narration?: string;
  fullName?: string;
  email?: string;
}

export interface LipilaTransactionResult {
  transactionId: string;  // Lipila's `identifier` field
  externalId: string;     // Lipila's `referenceId` field
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
  const phone = req.phone.replace(/^\+/, "");

  const res = await fetch(`${COLLECTION_BASE}/api/v1/collections/mobile-money`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.lipilaApiKey!,
    },
    body: JSON.stringify({
      amount: Number(req.amountZmw.toFixed(2)),
      currency: "ZMW",
      phoneNumber: phone,
      accountNumber: phone,
      narration: req.narration ?? "UStack Bitcoin deposit",
      referenceId: req.externalId,
    }),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { if (text) json = JSON.parse(text) as Record<string, unknown>; } catch { /* empty */ }

  if (!res.ok) {
    const errors = json.errors as Record<string, string[]> | undefined;
    const detail = errors ? Object.values(errors).flat().join("; ") : undefined;
    throw new Error(detail ?? (json.message as string) ?? (json.error as string) ?? `Lipila request failed (${res.status})`);
  }

  return {
    transactionId: (json.identifier as string) ?? req.externalId,
    externalId:    (json.referenceId as string) ?? req.externalId,
    status: "PENDING",
    message: "Payment request sent — check your phone for the USSD prompt",
  };
}

// Disburse funds to a mobile money account (we pay customer)
export async function disburseFunds(req: LipilaPaymentRequest): Promise<LipilaTransactionResult> {
  const config = getServerConfig();
  const phone = req.phone.replace(/^\+/, "");

  const res = await fetch(`${COLLECTION_BASE}/api/v1/disbursements/mobile-money`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.lipilaApiKey!,
    },
    body: JSON.stringify({
      amount: Number(req.amountZmw.toFixed(2)),
      currency: "ZMW",
      phoneNumber: phone,
      accountNumber: phone,
      narration: req.narration ?? "UStack payout",
      referenceId: req.externalId,
    }),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { if (text) json = JSON.parse(text) as Record<string, unknown>; } catch { /* empty */ }

  if (!res.ok) {
    const errors = json.errors as Record<string, string[]> | undefined;
    const detail = errors ? Object.values(errors).flat().join("; ") : undefined;
    throw new Error(detail ?? (json.message as string) ?? (json.error as string) ?? `Lipila disbursement failed (${res.status})`);
  }

  return {
    transactionId: (json.identifier as string) ?? req.externalId,
    externalId:    (json.referenceId as string) ?? req.externalId,
    status: "PENDING",
    message: "Disbursement initiated",
  };
}

// Poll transaction status via reporting API
export async function getLipilaStatus(transactionId: string): Promise<LipilaStatusResult> {
  const config = getServerConfig();

  // Try to find by identifier in the reporting API
  const res = await fetch(`${REPORTING_BASE}/transactions?pageSize=1&search=${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${config.lipilaApiKey}` },
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { if (text) json = JSON.parse(text) as Record<string, unknown>; } catch { /* empty */ }

  const rows = (json.data as Record<string, unknown>[]) ?? [];
  const row = rows.find((r) =>
    r.xReferenceId === transactionId ||
    r.transactionReferenceId === transactionId ||
    r.externalId === transactionId
  ) ?? rows[0];

  const rawStatus = ((row?.status as string) ?? "Pending").toUpperCase();
  const mapped: LipilaStatusResult["status"] =
    rawStatus === "SUCCESSFUL" || rawStatus === "SUCCESS" ? "SUCCESS"
    : rawStatus === "FAILED" || rawStatus === "CANCELLED" ? "FAILED"
    : "PENDING";

  return {
    transactionId,
    status: mapped,
    amount:      (row?.amount as number) ?? 0,
    currency:    "ZMW",
    phoneNumber: (row?.accountNumber as string) ?? "",
  };
}
