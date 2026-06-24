import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

export async function setStatusBarDark() {
  if (!isNative) return;
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#080A0F" });
}

export async function hideStatusBar() {
  if (!isNative) return;
  const { StatusBar } = await import("@capacitor/status-bar");
  await StatusBar.hide();
}

export async function showStatusBar() {
  if (!isNative) return;
  const { StatusBar } = await import("@capacitor/status-bar");
  await StatusBar.show();
}

export async function hideSplashScreen() {
  if (!isNative) return;
  const { SplashScreen } = await import("@capacitor/splash-screen");
  await SplashScreen.hide({ fadeOutDuration: 300 });
}

export type HapticStyle = "light" | "medium" | "heavy";
export async function haptic(style: HapticStyle = "light") {
  if (!isNative) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  await Haptics.impact({ style: map[style] });
}

export async function hapticSuccess() {
  if (!isNative) return;
  const { Haptics, NotificationType } = await import("@capacitor/haptics");
  await Haptics.notification({ type: NotificationType.Success });
}

export async function hapticWarning() {
  if (!isNative) return;
  const { Haptics, NotificationType } = await import("@capacitor/haptics");
  await Haptics.notification({ type: NotificationType.Warning });
}

export async function tryBiometricAuth(reason = "Unlock UStack"): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Use PIN instead",
      allowDeviceCredential: false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { BiometricAuth, BiometryType } = await import("@aparajita/capacitor-biometric-auth");
    const result = await BiometricAuth.checkBiometry();
    return result.isAvailable && result.biometryType !== BiometryType.none;
  } catch {
    return false;
  }
}
