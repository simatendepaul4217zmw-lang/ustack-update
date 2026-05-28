import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "./TopBar";
import { BottomNav, type Tab } from "./BottomNav";
import { SideDrawer } from "./SideDrawer";
import { Fab } from "./Fab";
import { HomeScreen } from "./screens/HomeScreen";
import { VaultsScreen } from "./screens/VaultsScreen";
import { ActivityScreen } from "./screens/ActivityScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { NotificationsSheet } from "./sheets/NotificationsSheet";
import { CreateVaultSheet } from "./sheets/CreateVaultSheet";
import { DepositSheet } from "./sheets/DepositSheet";
import { WithdrawSheet } from "./sheets/WithdrawSheet";
import { VaultDetailSheet } from "./sheets/VaultDetailSheet";
import type { Vault } from "@/lib/ustack-data";

export type SheetKind = null | "notifications" | "createVault" | "deposit" | "withdraw" | "vaultDetail";

export function AppShell() {
  const [tab, setTab] = useState<Tab>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [activeVault, setActiveVault] = useState<Vault | null>(null);

  const openVault = (v: Vault) => { setActiveVault(v); setSheet("vaultDetail"); };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center md:p-8 relative overflow-hidden">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full opacity-15 blur-3xl" style={{ background: "var(--grad-coral)" }} />
        <div className="absolute -bottom-40 -right-40 w-[40rem] h-[40rem] rounded-full opacity-10 blur-3xl" style={{ background: "var(--grad-teal)" }} />
      </div>

      {/* phone container */}
      <div className="relative w-full md:w-[420px] md:h-[860px] h-screen md:rounded-[3rem] overflow-hidden md:border md:border-white/10 md:shadow-float bg-background">
        {/* Side drawer behind everything */}
        <SideDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSelect={(t) => { setTab(t); setDrawerOpen(false); }}
        />

        {/* Main app surface — animates when drawer opens */}
        <motion.div
          animate={drawerOpen ? { scale: 0.86, x: "62%", borderRadius: 32 } : { scale: 1, x: 0, borderRadius: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="absolute inset-0 bg-background overflow-hidden origin-left"
          style={{ boxShadow: drawerOpen ? "0 32px 64px -16px rgba(0,0,0,0.6)" : "none" }}
        >
          {drawerOpen && (
            <button
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 z-50"
            />
          )}

          <div className="relative h-full flex flex-col">
            <TopBar onMenu={() => setDrawerOpen(true)} onBell={() => setSheet("notifications")} />

            <div className="flex-1 overflow-y-auto no-scrollbar pb-36">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                >
                  {tab === "home" && <HomeScreen onOpenVault={openVault} onDeposit={() => setSheet("deposit")} onWithdraw={() => setSheet("withdraw")} onCreateVault={() => setSheet("createVault")} />}
                  {tab === "vaults" && <VaultsScreen onOpenVault={openVault} onCreateVault={() => setSheet("createVault")} />}
                  {tab === "activity" && <ActivityScreen />}
                  {tab === "profile" && <ProfileScreen />}
                </motion.div>
              </AnimatePresence>
            </div>

            <BottomNav tab={tab} onChange={setTab} />
            <Fab
              onCreateVault={() => setSheet("createVault")}
              onAddFunds={() => setSheet("deposit")}
              onSend={() => setSheet("withdraw")}
              onWithdraw={() => setSheet("withdraw")}
            />
          </div>
        </motion.div>

        {/* Sheets */}
        <NotificationsSheet open={sheet === "notifications"} onClose={() => setSheet(null)} />
        <CreateVaultSheet open={sheet === "createVault"} onClose={() => setSheet(null)} onDeposit={() => setSheet("deposit")} />
        <DepositSheet open={sheet === "deposit"} onClose={() => setSheet(null)} />
        <WithdrawSheet open={sheet === "withdraw"} onClose={() => setSheet(null)} />
        <VaultDetailSheet open={sheet === "vaultDetail"} vault={activeVault} onClose={() => setSheet(null)} onDeposit={() => setSheet("deposit")} onWithdraw={() => setSheet("withdraw")} />
      </div>
    </div>
  );
}
