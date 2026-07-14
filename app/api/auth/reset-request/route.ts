import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { sql, ensureSchema } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Start a password reset. Looks up the user by email or username, stores a
// short-lived token, and emails the reset link. Always returns ok so the
// endpoint can't be used to enumerate accounts.
export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const identifier = (body.identifier ?? "").toString().trim();

  if (identifier) {
    const rows = (await sql`
      SELECT id, email FROM users
      WHERE username = ${identifier} OR lower(email) = lower(${identifier})
      LIMIT 1
    `) as { id: string; email: string | null }[];
    const user = rows[0];

    if (user?.email) {
      const token = nanoid(32);
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await sql`
        INSERT INTO password_resets (token, user_id, expires_at)
        VALUES (${token}, ${user.id}, ${expires.toISOString()})
      `;

      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
      const proto = req.headers.get("x-forwarded-proto") ?? "http";
      const origin = process.env.NEXT_PUBLIC_BASE_URL ?? `${proto}://${host}`;
      await sendPasswordResetEmail(user.email, `${origin}/admin/reset/${token}`);
    }
  }

  return NextResponse.json({ ok: true });
}
