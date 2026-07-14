import { Resend } from "resend";

const FROM = process.env.RESEND_FROM ?? "FlyppBook <onboarding@resend.dev>";

/**
 * Send a password-reset link. Uses Resend when RESEND_API_KEY is configured;
 * otherwise logs the link to the server console so the flow still works in
 * local development.
 */
export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] password reset for ${to} → ${link}`);
    return;
  }

  const resend = new Resend(key);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your FlyppBook password",
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto">
        <h2 style="font-weight:600">Reset your FlyppBook password</h2>
        <p>Click the link below to choose a new password. This link expires in 1 hour.</p>
        <p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Reset password</a></p>
        <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Invite a newly created user to activate their account by setting a password.
 * Same fallback behaviour as password reset when RESEND_API_KEY is absent.
 */
export async function sendInviteEmail(to: string, link: string, username: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] invite for ${username} <${to}> → ${link}`);
    return;
  }

  const resend = new Resend(key);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You've been invited to FlyppBook",
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto">
        <h2 style="font-weight:600">Welcome to FlyppBook</h2>
        <p>An account has been created for you with the username <strong>${username}</strong>.
           Set your password to activate it. This link expires in 7 days.</p>
        <p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Set your password</a></p>
        <p style="color:#666;font-size:13px">If you weren't expecting this, you can ignore this email.</p>
      </div>
    `,
  });
}
