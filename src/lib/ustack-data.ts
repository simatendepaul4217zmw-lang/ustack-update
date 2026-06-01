export type VaultType = "hodl" | "stack";

export interface Vault {
  id: string;
  name: string;
  type: VaultType;
  goalSats: number;
  currentSats: number;
  goalFiat: number;
  currency: string;
  daysRemaining: number;
  streakDays: number;
  locked: boolean;
  accent: "coral" | "teal" | "mint" | "aqua" | "btc";
  emoji: string;
  // server-side extended fields
  lockedUntil?: string | null;
  penaltyPct?: number;
  status?: string;
  createdAt?: string;
}

export interface Activity {
  id: string;
  kind: "deposit" | "milestone" | "streak" | "protection" | "withdraw" | "vault" | "vault_deposit" | "vault_withdraw" | "vault_created" | "send" | "login";
  title: string;
  meta: string;
  when: string;
}

export interface Notif {
  id: string;
  kind: "milestone" | "deposit" | "protection" | "summary" | "warning";
  title: string;
  body: string;
  when: string;
  unread?: boolean;
}

export const totalBalanceSats = 4_812_000;
export const lockedSats = 3_600_000;
export const availableSats = totalBalanceSats - lockedSats;
export const monthlyStackedSats = 412_000;
export const monthlyGoalSats = 600_000;

export const vaults: Vault[] = [
  { id: "v1", name: "Tuition Vault", type: "hodl", goalSats: 2_000_000, currentSats: 1_240_000, goalFiat: 12000, currency: "ZMW", daysRemaining: 184, streakDays: 21, locked: true, accent: "coral", emoji: "🎓" },
  { id: "v2", name: "Laptop Fund", type: "stack", goalSats: 1_500_000, currentSats: 980_000, goalFiat: 8500, currency: "ZMW", daysRemaining: 92, streakDays: 7, locked: false, accent: "teal", emoji: "💻" },
  { id: "v3", name: "Emergency Savings", type: "hodl", goalSats: 3_000_000, currentSats: 1_820_000, goalFiat: 18000, currency: "ZMW", daysRemaining: 365, streakDays: 41, locked: true, accent: "mint", emoji: "🛡️" },
  { id: "v4", name: "Future Business", type: "stack", goalSats: 5_000_000, currentSats: 612_000, goalFiat: 32000, currency: "ZMW", daysRemaining: 540, streakDays: 12, locked: false, accent: "aqua", emoji: "🚀" },
  { id: "v5", name: "Travel Goal", type: "stack", goalSats: 800_000, currentSats: 160_000, goalFiat: 5000, currency: "ZMW", daysRemaining: 120, streakDays: 4, locked: false, accent: "btc", emoji: "✈️" },
];

export const activity: Activity[] = [
  { id: "a1", kind: "deposit", title: "You added 20,000 sats", meta: "Tuition Vault · Mobile Money", when: "2h ago" },
  { id: "a2", kind: "milestone", title: "Emergency Savings reached 60%", meta: "Milestone unlocked", when: "Yesterday" },
  { id: "a3", kind: "streak", title: "7 day stacking streak", meta: "Keep it going!", when: "2d ago" },
  { id: "a4", kind: "deposit", title: "You added 50,000 sats", meta: "Laptop Fund · Lightning", when: "3d ago" },
  { id: "a5", kind: "protection", title: "Price protection triggered", meta: "BTC dipped 3.2%", when: "5d ago" },
  { id: "a6", kind: "vault", title: "Created Travel Goal vault", meta: "Stack Vault · 120 days", when: "1w ago" },
];

export const notifications: Notif[] = [
  { id: "n1", kind: "milestone", title: "Milestone reached", body: "Emergency Savings hit 60% of goal.", when: "2h ago", unread: true },
  { id: "n2", kind: "deposit", title: "Deposit successful", body: "20,000 sats added to Tuition Vault.", when: "2h ago", unread: true },
  { id: "n3", kind: "protection", title: "Protection triggered", body: "BTC dropped 3.2%. Your stack is shielded.", when: "5d ago" },
  { id: "n4", kind: "summary", title: "Weekly summary", body: "You stacked 142,000 sats this week.", when: "Mon" },
  { id: "n5", kind: "warning", title: "Penalty reminder", body: "Withdrawing from a Hodl Vault may slow your progress.", when: "1w ago" },
];

export const tips = [
  { title: "Stack a little, often", body: "Small recurring deposits beat large irregular ones. Consistency builds the habit." },
  { title: "Name your goal", body: "Vaults with clear names, like Tuition or Laptop, are 3x more likely to be completed." },
  { title: "Lock to commit", body: "Hodl Vaults are harder to touch. That's the point. Future you will say thanks." },
  { title: "Celebrate milestones", body: "Hitting 25%, 50%, 75% matters. Discipline compounds like sats." },
];

export const fmtSats = (n: number) => n.toLocaleString("en-US");
export const fmtBTC = (sats: number) => (sats / 100_000_000).toFixed(4);

export const BTC_PRICE_ZMW = 600_000; // 1 BTC = K 600,000 (fallback when live price is unavailable)
export const satsToZMW = (sats: number, priceZmw = BTC_PRICE_ZMW) => (sats / 100_000_000) * priceZmw;
export const fmtZMW = (sats: number, priceZmw = BTC_PRICE_ZMW) => {
  const k = satsToZMW(sats, priceZmw);
  return `K ${k < 1 ? k.toFixed(2) : Math.round(k).toLocaleString("en-US")}`;
};
