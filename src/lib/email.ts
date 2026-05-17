import { Resend } from "resend";
import { getPlatformBranding, BRANDING_DEFAULTS, type PlatformBranding } from "@/lib/platform-config";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

async function getBrandingIfEnabled(): Promise<PlatformBranding | null> {
  try {
    const b = await getPlatformBranding();
    if (b.email_enabled !== "true") return null;
    return b;
  } catch {
    return null;
  }
}

function baseHtml(branding: PlatformBranding, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0A0B0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0B0F;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#12131A;border:1px solid #1E2028;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #1E2028;">
          <h2 style="margin:0;color:#00D4FF;font-size:20px;font-weight:700;">${branding.platform_name}</h2>
        </td></tr>
        <tr><td style="padding:32px;color:#E0E0E0;font-size:15px;line-height:1.7;">
          ${body}
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #1E2028;text-align:center;">
          <p style="margin:0;color:#666;font-size:12px;">
            © ${new Date().getFullYear()} ${branding.platform_name} &middot; ${branding.platform_domain}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail(to: string, displayName: string) {
  const resend = getResend();
  if (!resend) return;
  const b = await getBrandingIfEnabled();
  if (!b) return;

  await resend.emails.send({
    from: `${b.email_from_name} <${b.email_from_address}>`,
    to,
    subject: `Welcome to ${b.platform_name}`,
    html: baseHtml(b, `
      <h3 style="color:#fff;margin:0 0 16px;">Welcome, ${displayName}!</h3>
      <p>Thank you for creating an account with ${b.platform_name}.</p>
      <p>Your account is currently <strong style="color:#F59E0B;">pending approval</strong>. ${b.approval_time_text}</p>
      <p>We'll send you another email once your account has been approved and is ready to use.</p>
      <p style="margin-top:24px;color:#888;">— The ${b.platform_name} Team</p>
    `),
  }).catch((err) => console.error("Email send error (welcome):", err));
}

export async function sendApprovalEmail(to: string, displayName: string) {
  const resend = getResend();
  if (!resend) return;
  const b = await getBrandingIfEnabled();
  if (!b) return;

  await resend.emails.send({
    from: `${b.email_from_name} <${b.email_from_address}>`,
    to,
    subject: `Your ${b.platform_name} Account Has Been Approved`,
    html: baseHtml(b, `
      <h3 style="color:#fff;margin:0 0 16px;">Account Approved</h3>
      <p>Hi ${displayName},</p>
      <p>Great news — your account has been <strong style="color:#34D399;">approved</strong>! You now have full access to the ${b.platform_name} platform.</p>
      <p><a href="https://${b.platform_domain}/auth/login" style="display:inline-block;margin-top:16px;padding:12px 28px;background:linear-gradient(to right,#00D4FF,#0EA5E9);color:#0A0B0F;font-weight:600;border-radius:8px;text-decoration:none;">Sign In Now</a></p>
      <p style="margin-top:24px;color:#888;">— The ${b.platform_name} Team</p>
    `),
  }).catch((err) => console.error("Email send error (approval):", err));
}

export async function sendDepositEmail(to: string, displayName: string, amount: number, currency = "USD") {
  const resend = getResend();
  if (!resend) return;
  const b = await getBrandingIfEnabled();
  if (!b) return;

  await resend.emails.send({
    from: `${b.email_from_name} <${b.email_from_address}>`,
    to,
    subject: `Deposit Credited — ${b.platform_name}`,
    html: baseHtml(b, `
      <h3 style="color:#fff;margin:0 0 16px;">Deposit Confirmed</h3>
      <p>Hi ${displayName},</p>
      <p>Your deposit of <strong style="color:#34D399;">$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency}</strong> has been credited to your account.</p>
      <p>You can view your updated balance on your <a href="https://${b.platform_domain}/dashboard" style="color:#00D4FF;text-decoration:underline;">dashboard</a>.</p>
      <p style="margin-top:24px;color:#888;">— The ${b.platform_name} Team</p>
    `),
  }).catch((err) => console.error("Email send error (deposit):", err));
}

export async function sendWithdrawalSubmittedEmail(to: string, displayName: string, amount: number, method: string) {
  const resend = getResend();
  if (!resend) return;
  const b = await getBrandingIfEnabled();
  if (!b) return;

  await resend.emails.send({
    from: `${b.email_from_name} <${b.email_from_address}>`,
    to,
    subject: `Withdrawal Request Received — ${b.platform_name}`,
    html: baseHtml(b, `
      <h3 style="color:#fff;margin:0 0 16px;">Withdrawal Request Received</h3>
      <p>Hi ${displayName},</p>
      <p>We've received your withdrawal request:</p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:6px 16px 6px 0;color:#888;">Amount</td><td style="padding:6px 0;color:#fff;font-weight:600;">$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#888;">Method</td><td style="padding:6px 0;color:#fff;">${method}</td></tr>
      </table>
      <p>Our team will process this shortly. You'll be notified once it's approved.</p>
      <p style="margin-top:24px;color:#888;">— The ${b.platform_name} Team</p>
    `),
  }).catch((err) => console.error("Email send error (withdrawal submitted):", err));
}

export async function sendWithdrawalApprovedEmail(to: string, displayName: string, amount: number) {
  const resend = getResend();
  if (!resend) return;
  const b = await getBrandingIfEnabled();
  if (!b) return;

  await resend.emails.send({
    from: `${b.email_from_name} <${b.email_from_address}>`,
    to,
    subject: `Withdrawal Approved — ${b.platform_name}`,
    html: baseHtml(b, `
      <h3 style="color:#fff;margin:0 0 16px;">Withdrawal Approved</h3>
      <p>Hi ${displayName},</p>
      <p>Your withdrawal of <strong style="color:#34D399;">$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong> has been <strong style="color:#34D399;">approved</strong> and is being processed.</p>
      <p>Please allow time for the transfer to complete depending on the withdrawal method.</p>
      <p style="margin-top:24px;color:#888;">— The ${b.platform_name} Team</p>
    `),
  }).catch((err) => console.error("Email send error (withdrawal approved):", err));
}

export async function sendWithdrawalRejectedEmail(to: string, displayName: string, amount: number) {
  const resend = getResend();
  if (!resend) return;
  const b = await getBrandingIfEnabled();
  if (!b) return;

  await resend.emails.send({
    from: `${b.email_from_name} <${b.email_from_address}>`,
    to,
    subject: `Withdrawal Update — ${b.platform_name}`,
    html: baseHtml(b, `
      <h3 style="color:#fff;margin:0 0 16px;">Withdrawal Update</h3>
      <p>Hi ${displayName},</p>
      <p>Your withdrawal request of <strong>$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong> was <strong style="color:#EF4444;">not approved</strong>.</p>
      <p>If you have questions, please contact your dedicated account manager or email us at <a href="mailto:${b.email_from_address}" style="color:#00D4FF;">${b.email_from_address}</a>.</p>
      <p style="margin-top:24px;color:#888;">— The ${b.platform_name} Team</p>
    `),
  }).catch((err) => console.error("Email send error (withdrawal rejected):", err));
}

export async function sendAdminNewSignupAlert(displayName: string, email: string) {
  const resend = getResend();
  if (!resend) return;
  const b = await getBrandingIfEnabled();
  if (!b) return;

  await resend.emails.send({
    from: `${b.email_from_name} <${b.email_from_address}>`,
    to: b.admin_alert_email,
    subject: `New Signup — ${displayName}`,
    html: baseHtml(b, `
      <h3 style="color:#fff;margin:0 0 16px;">New User Signup</h3>
      <p>A new user has registered and is awaiting approval:</p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:6px 16px 6px 0;color:#888;">Name</td><td style="padding:6px 0;color:#fff;">${displayName}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#888;">Email</td><td style="padding:6px 0;color:#fff;">${email}</td></tr>
      </table>
      <p><a href="https://${b.platform_domain}/admin/clients" style="display:inline-block;margin-top:8px;padding:10px 24px;background:linear-gradient(to right,#00D4FF,#0EA5E9);color:#0A0B0F;font-weight:600;border-radius:8px;text-decoration:none;">Review in Admin</a></p>
    `),
  }).catch((err) => console.error("Email send error (admin alert):", err));
}
