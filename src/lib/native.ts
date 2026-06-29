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

// ── WebAuthn (web biometric) ──────────────────────────────────────────────────

const BIO_KEY = "ustack_bio_cred";

export async function isWebBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.() ?? Promise.resolve(false));
  } catch {
    return false;
  }
}

export function isWebBiometricRegistered(): boolean {
  try { return !!localStorage.getItem(BIO_KEY); } catch { return false; }
}

export async function registerWebBiometric(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    const avail = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
    if (!avail) return false;

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "UStack", id: window.location.hostname },
        user: { id: userId, name: "ustack", displayName: "UStack User" },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" as const },
          { alg: -257, type: "public-key" as const },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform" as const,
          userVerification: "required" as const,
          residentKey: "preferred" as const,
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!cred) return false;
    localStorage.setItem(BIO_KEY, btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
    return true;
  } catch {
    return false;
  }
}

export async function tryWebBiometric(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    const stored = localStorage.getItem(BIO_KEY);
    if (!stored) return false;
    const credId = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const result = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: credId, type: "public-key" as const }],
        userVerification: "required" as const,
        timeout: 60000,
      },
    });
    return !!result;
  } catch {
    return false;
  }
}

export function clearWebBiometric() {
  try { localStorage.removeItem(BIO_KEY); } catch {}
}

// ── Biometric auth (native + web) ─────────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
  if (isNative) {
    try {
      const { BiometricAuth, BiometryType } = await import("@aparajita/capacitor-biometric-auth");
      const result = await BiometricAuth.checkBiometry();
      return result.isAvailable && result.biometryType !== BiometryType.none;
    } catch {
      return false;
    }
  }
  return isWebBiometricAvailable();
}

export async function tryBiometricAuth(reason = "Unlock UStack"): Promise<boolean> {
  if (isNative) {
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
  return tryWebBiometric();
}
