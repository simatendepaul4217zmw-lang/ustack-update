import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
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
import { SendSheet } from "./sheets/SendSheet";
import { VaultDetailSheet } from "./sheets/VaultDetailSheet";
import { SettingsSheet } from "./sheets/SettingsSheet";
import { HelpSheet } from "./sheets/HelpSheet";
import { EditProfileSheet } from "./sheets/EditProfileSheet";
import type { Vault } from "@/lib/ustack-data";

export type SheetKind =
  | null
  | "notifications"
  | "createVault"
  | "deposit"
  | "withdraw"
  | "send"
  | "vaultDetail"
  | "settings"
  | "help"
  | "editProfile";

export function AppShell() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [activeVault, setActiveVault] = useState<Vault | null>(null);
  const [depositVault, setDepositVault] = useState<Vault | null>(null);
  const [withdrawVault, setWithdrawVault] = useState<Vault | null>(null);

  const openVault = (v: Vault) => { setActiveVault(v); setSheet("vaultDetail"); };
  const logout = () => nav({ to: "/welcome" });

  const openDeposit = (vault?: Vault) => {
    setDepositVault(vault ?? null);
    setSheet("deposit");
  };
  const openWithdraw = (vault?: Vault) => {
    setWithdrawVault(vault ?? null);
    setSheet("withdraw");
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center md:p-8 relative overflow-hidden">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full opacity-15 blur-3xl" style={{ background: "var(--grad-coral)" }} />
        <div className="absolute -bottom-40 -right-40 w-[40rem] h-[40rem] rounded-full opacity-10 blur-3xl" style={{ background: "var(--grad-teal)" }} />
      </div>

      {/* phone container */}
      <div className="relative w-full md:w-[420px] md:h-[860px] h-screen md:rounded-[3rem] overflow-hidden md:border md:border-white/10 md:shadow-float bg-background">
        <SideDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSelect={(t) => { setTab(t); setDrawerOpen(false); }}
          onSettings={() => { setDrawerOpen(false); setSheet("settings"); }}
          onHelp={() => { setDrawerOpen(false); setSheet("help"); }}
          onPriceProtection={() => { setDrawerOpen(false); setTab("profile"); }}
          onLogout={logout}
        />

        <motion.div
          animate={drawerOpen ? { scale: 0.86, x: "62%", borderRadius: 32 } : { scale: 1, x: 0, borderRadius: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="absolute inset-0 bg-background overflow-hidden origin-left"
          style={{ boxShadow: drawerOpen ? "0 32px 64px -16px rgba(0,0,0,0.6)" : "none" }}
        >
          {drawerOpen && (
            <button aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="absolute inset-0 z-50" />
          )}

          <div className="relative h-full flex flex-col">
            <TopBar onMenu={() => setDrawerOpen(true)} onBell={() => setSheet("notifications")} />

            <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                >
                  {tab === "home" && (
                    <HomeScreen
                      onOpenVault={openVault}
                      onDeposit={() => openDeposit()}
                      onWithdraw={() => openWithdraw()}
                      onSend={() => setSheet("send")}
                      onCreateVault={() => setSheet("createVault")}
                    />
                  )}
                  {tab === "vaults" && <VaultsScreen onOpenVault={openVault} onCreateVault={() => setSheet("createVault")} />}
                  {tab === "activity" && <ActivityScreen />}
                  {tab === "profile" && (
                    <ProfileScreen
                      onEdit={() => setSheet("editProfile")}
                      onSettings={() => setSheet("settings")}
                      onHelp={() => setSheet("help")}
                      onLogout={logout}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <BottomNav tab={tab} onChange={setTab} />
            <Fab
              onCreateVault={() => setSheet("createVault")}
              onAddFunds={() => openDeposit()}
              onSend={() => setSheet("send")}
              onWithdraw={() => openWithdraw()}
            />
          </div>
        </motion.div>

        {/* Sheets */}
        <NotificationsSheet open={sheet === "notifications"} onClose={() => setSheet(null)} />
        <CreateVaultSheet open={sheet === "createVault"} onClose={() => setSheet(null)} onDeposit={() => openDeposit()} />
        <DepositSheet
          open={sheet === "deposit"}
          onClose={() => { setSheet(null); setDepositVault(null); }}
          vaultContext={depositVault}
        />
        <WithdrawSheet
          open={sheet === "withdraw"}
          onClose={() => { setSheet(null); setWithdrawVault(null); }}
          vaultContext={withdrawVault}
        />
        <SendSheet open={sheet === "send"} onClose={() => setSheet(null)} />
        <VaultDetailSheet
          open={sheet === "vaultDetail"}
          vault={activeVault}
          onClose={() => setSheet(null)}
          onDeposit={() => { setSheet(null); setTimeout(() => openDeposit(activeVault!), 120); }}
          onWithdraw={() => { setSheet(null); setTimeout(() => openWithdraw(activeVault!), 120); }}
        />
        <SettingsSheet open={sheet === "settings"} onClose={() => setSheet(null)} />
        <HelpSheet open={sheet === "help"} onClose={() => setSheet(null)} />
        <EditProfileSheet open={sheet === "editProfile"} onClose={() => setSheet(null)} />
      </div>
    </div>
  );
}
