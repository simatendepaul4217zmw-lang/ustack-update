import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/context/auth-context";
import { getWallet } from "@/lib/api/wallet.functions";
import { getVaults, createVault, depositToVault, withdrawFromVault } from "@/lib/api/vault.functions";
import { getActivity, getNotifications, markNotificationsRead } from "@/lib/api/activity.functions";
import { getBtcPrice } from "@/lib/api/price.functions";
import { createInvoice, sendPayment, mobileMoneySend, mobileMoneyPayout, checkMomoStatus, checkInvoiceStatus } from "@/lib/api/lightning.functions";
import { updateProfile } from "@/lib/api/auth.functions";
import { getPriceProtection, updatePriceProtection } from "@/lib/api/priceprotection.functions";

// ── Wallet ────────────────────────────────────────────────────────────────────

export function useWallet() {
  const { token, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["wallet", token],
    queryFn: () => getWallet({ data: { token: token! } }),
    enabled: !!token && isAuthenticated,
    staleTime: 30_000,
  });
}

// ── Vaults ────────────────────────────────────────────────────────────────────

export function useVaults() {
  const { token, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["vaults", token],
    queryFn: () => getVaults({ data: { token: token! } }),
    enabled: !!token && isAuthenticated,
    staleTime: 30_000,
  });
}

export function useCreateVault() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      goalSats: number;
      vaultType: "stack" | "hodl";
      accent?: "aqua" | "coral" | "teal" | "mint" | "btc";
      emoji?: string;
      goalFiat?: number;
      currency?: string;
      lockMonths?: number;
    }) => createVault({ data: { ...vars, token: token! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vaults"] }),
  });
}

export function useDepositToVault() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { vaultId: string; amountSats: number }) =>
      depositToVault({ data: { ...vars, token: token! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaults"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useWithdrawFromVault() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { vaultId: string; amountSats: number }) =>
      withdrawFromVault({ data: { ...vars, token: token! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaults"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

// ── Activity & Notifications ──────────────────────────────────────────────────

export function useActivity() {
  const { token, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["activity", token],
    queryFn: () => getActivity({ data: { token: token!, limit: 40 } }),
    enabled: !!token && isAuthenticated,
    staleTime: 30_000,
  });
}

export function useNotifications() {
  const { token, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["notifications", token],
    queryFn: () => getNotifications({ data: { token: token! } }),
    enabled: !!token && isAuthenticated,
    staleTime: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markNotificationsRead({ data: { token: token! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// ── BTC Price ─────────────────────────────────────────────────────────────────

export function useBtcPrice() {
  return useQuery({
    queryKey: ["btcPrice"],
    queryFn: () => getBtcPrice({ data: {} }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// ── Lightning / Deposits ──────────────────────────────────────────────────────

export function useCreateInvoice() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (vars: { amountSats: number; memo?: string }) =>
      createInvoice({ data: { ...vars, token: token! } }),
  });
}

export function useSendPayment() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { paymentRequest: string; amountSats: number }) =>
      sendPayment({ data: { ...vars, token: token! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useMobileMoneyDeposit() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { phone: string; amountSats: number; provider: "airtel" | "mtn" | "zamtel" }) =>
      mobileMoneySend({ data: { ...vars, token: token! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useMobileMoneyPayout() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { phone: string; amountSats: number; provider: "airtel" | "mtn" | "zamtel" }) =>
      mobileMoneyPayout({ data: { ...vars, token: token! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

// ── Profile ───────────────────────────────────────────────────────────────────

export function useUpdateProfile() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: (vars: { displayName?: string; avatarColor?: string }) =>
      updateProfile({ data: { ...vars, token: token! } }),
  });
}

// ── Price Protection ──────────────────────────────────────────────────────────

export function usePriceProtection() {
  const { token, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["priceProtection", token],
    queryFn: () => getPriceProtection({ data: { token: token! } }),
    enabled: !!token && isAuthenticated,
    staleTime: 60_000,
  });
}

export function useCheckInvoiceStatus(paymentHash: string | null) {
  const { token, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["invoiceStatus", paymentHash],
    queryFn: async () => {
      const result = await checkInvoiceStatus({ data: { token: token!, paymentHash: paymentHash! } });
      if (result.status === "confirmed") {
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["activity"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      }
      return result;
    },
    enabled: !!token && isAuthenticated && !!paymentHash,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "confirmed" || status === "failed" ? false : 3000;
    },
  });
}

export function useUpdatePriceProtection() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { enabled: boolean; thresholdPct: number }) =>
      updatePriceProtection({ data: { ...vars, token: token! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["priceProtection"] }),
  });
}
