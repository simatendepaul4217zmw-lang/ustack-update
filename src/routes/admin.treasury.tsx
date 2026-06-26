import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Wallet,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/admin/treasury")({
  head: () => ({
    meta: [{ title: "Treasury Dashboard — UStack Admin" }],
  }),
  component: TreasuryDashboard,
});

interface PendingTx {
  id: string;
  user_id: string;
  amount_sats: number;
  external_id: string | null;
  exchange_rate_zmw: number | null;
  metadata: { phone?: string; provider?: string; amountZmw?: number };
  created_at: string;
}

interface WalletTransfer {
  id: string;
  from_wallet: string;
  to_wallet: string;
  amount_sats: number;
  reason: string | null;
  blink_tx_id: string | null;
  transaction_id: string | null;
  created_at: string;
}

interface DashboardData {
  main_balance_sats: number | null;
  reserve_balance_sats: number;
  reserve_minimum_sats: number;
  reserve_utilization_pct: number | null;
  is_low_reserve: boolean;
  total_user_liabilities_sats: number;
  pending_deposits: PendingTx[];
  pending_withdrawals: PendingTx[];
  recent_transfers: WalletTransfer[];
  fetched_at: string;
}

function formatSats(sats: number | null | undefined): string {
  if (sats == null) return "—";
  if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M sats`;
  if (sats >= 1_000) return `${(sats / 1_000).toFixed(1)}k sats`;
  return `${sats.toLocaleString()} sats`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function MetricCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "warn" | "ok" | "neutral";
  icon: React.ReactNode;
}) {
  const borderColor =
    accent === "warn"
      ? "border-amber-500/40"
      : accent === "ok"
      ? "border-emerald-500/40"
      : "border-border";
  const valColor =
    accent === "warn"
      ? "text-amber-400"
      : accent === "ok"
      ? "text-emerald-400"
      : "text-foreground";

  return (
    <div
      className={`rounded-xl border ${borderColor} bg-card p-5 flex flex-col gap-3`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground opacity-60">{icon}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valColor}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PendingTable({
  rows,
  label,
}: {
  rows: PendingTx[];
  label: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">{label}</h3>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-500" /> None pending
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        {label}{" "}
        <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
          {rows.length}
        </span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 pr-4 text-left font-medium">Amount</th>
              <th className="py-2 pr-4 text-left font-medium">Phone</th>
              <th className="py-2 pr-4 text-left font-medium">Provider</th>
              <th className="py-2 pr-4 text-left font-medium">ZMW Rate</th>
              <th className="py-2 text-left font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-4 font-mono font-medium text-foreground">
                  {formatSats(tx.amount_sats)}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {tx.metadata.phone ?? "—"}
                </td>
                <td className="py-2 pr-4 text-muted-foreground capitalize">
                  {tx.metadata.provider ?? "—"}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {tx.exchange_rate_zmw
                    ? `K${(tx.exchange_rate_zmw / 1e8).toFixed(0)}`
                    : "—"}
                </td>
                <td className="py-2 text-muted-foreground">{timeAgo(tx.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransfersLog({ rows }: { rows: WalletTransfer[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        Recent Wallet Transfers
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No transfers recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Direction</th>
                <th className="py-2 pr-4 text-left font-medium">Amount</th>
                <th className="py-2 pr-4 text-left font-medium">Reason</th>
                <th className="py-2 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((wt) => {
                const isToMain = wt.to_wallet === "main";
                return (
                  <tr key={wt.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isToMain
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-blue-500/15 text-blue-400"
                        }`}
                      >
                        <ArrowRightLeft size={9} />
                        {wt.from_wallet} → {wt.to_wallet}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono font-medium text-foreground">
                      {formatSats(wt.amount_sats)}
                    </td>
                    <td
                      className="py-2 pr-4 max-w-[200px] truncate text-muted-foreground"
                      title={wt.reason ?? ""}
                    >
                      {wt.reason ?? "—"}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {timeAgo(wt.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TreasuryDashboard() {
  const [token, setToken] = useState<string>(() =>
    typeof window !== "undefined"
      ? (sessionStorage.getItem("admin_token") ?? "")
      : ""
  );
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (tok: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/treasury-dashboard", {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (res.status === 401) {
          setAuthError("Invalid token — access denied.");
          setToken("");
          sessionStorage.removeItem("admin_token");
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as DashboardData;
        setData(json);
        setLastRefreshed(new Date());
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!token) return;
    fetchData(token);
    timerRef.current = setInterval(() => fetchData(token), 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token, fetchData]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const t = tokenInput.trim();
    if (!t) return;
    sessionStorage.setItem("admin_token", t);
    setToken(t);
  }

  // Login gate
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Lock size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Admin Access</h1>
              <p className="text-xs text-muted-foreground">Treasury Dashboard</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Admin Token
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                placeholder="Enter admin token"
                autoFocus
              />
            </div>
            {authError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <XCircle size={12} /> {authError}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Treasury Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              {lastRefreshed
                ? `Last updated ${lastRefreshed.toLocaleTimeString()}`
                : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData(token)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem("admin_token");
                setToken("");
                setData(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Low reserve warning banner */}
        {data?.is_low_reserve && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-300">
                Reserve Wallet Low
              </p>
              <p className="mt-0.5 text-xs text-amber-400/80">
                Reserve balance ({formatSats(data.reserve_balance_sats)}) is below
                the minimum threshold ({formatSats(data.reserve_minimum_sats)}).
                Top up the reserve wallet to ensure MoMo deposits continue
                processing.
              </p>
            </div>
          </div>
        )}

        {/* Metric cards */}
        {data ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricCard
                label="Main Wallet"
                value={formatSats(data.main_balance_sats)}
                sub="Customer BTC (Blink)"
                icon={<Wallet size={16} />}
                accent="neutral"
              />
              <MetricCard
                label="Reserve Wallet"
                value={formatSats(data.reserve_balance_sats)}
                sub={`Min: ${formatSats(data.reserve_minimum_sats)}`}
                icon={<Wallet size={16} />}
                accent={data.is_low_reserve ? "warn" : "ok"}
              />
              <MetricCard
                label="User Liabilities"
                value={formatSats(data.total_user_liabilities_sats)}
                sub="Sum of all user balances"
                icon={<ArrowRightLeft size={16} />}
                accent="neutral"
              />
              <MetricCard
                label="Reserve Utilization"
                value={
                  data.reserve_utilization_pct != null
                    ? `${data.reserve_utilization_pct}%`
                    : "—"
                }
                sub="Reserve vs minimum threshold"
                icon={<CheckCircle2 size={16} />}
                accent={
                  data.reserve_utilization_pct != null &&
                  data.reserve_utilization_pct < 100
                    ? "warn"
                    : "ok"
                }
              />
            </div>

            {/* Pending transactions */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PendingTable
                rows={data.pending_deposits}
                label="Pending MoMo Deposits"
              />
              <PendingTable
                rows={data.pending_withdrawals}
                label="Pending MoMo Withdrawals"
              />
            </div>

            {/* Wallet transfers log */}
            <TransfersLog rows={data.recent_transfers} />

            {/* Footer */}
            <p className="text-center text-[10px] text-muted-foreground/50">
              Auto-refreshes every 30 seconds ·{" "}
              <Clock size={9} className="inline" /> Fetched at{" "}
              {new Date(data.fetched_at).toLocaleTimeString()}
            </p>
          </>
        ) : loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            <RefreshCw size={16} className="mr-2 animate-spin" /> Loading
            treasury data…
          </div>
        ) : null}
      </div>
    </div>
  );
}
