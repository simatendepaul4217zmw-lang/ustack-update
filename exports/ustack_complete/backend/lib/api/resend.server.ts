import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const resend = getResend();

  const { error } = await resend.emails.send({
    from: "UStack <onboarding@ustack.site>",
    to,
    subject: `${code} is your UStack code`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;background:#1e1f26;border-radius:16px;color:#f0f0f0;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
          <div style="width:36px;height:36px;background:#f97316;border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-weight:800;font-size:18px;">U</span>
          </div>
          <span style="font-size:16px;font-weight:600;letter-spacing:0.02em;">UStack</span>
        </div>
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;">Your verification code</h2>
        <p style="color:#9ca3af;font-size:14px;margin:0 0 28px;">Enter this code to continue. It expires in 5 minutes.</p>
        <div style="background:#2a2b35;border-radius:12px;padding:20px;text-align:center;letter-spacing:0.25em;font-size:36px;font-weight:800;font-family:monospace;color:#f97316;">
          ${code}
        </div>
        <p style="color:#6b7280;font-size:12px;margin:24px 0 0;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) throw new Error(`Failed to send email: ${error.message}`);
}
