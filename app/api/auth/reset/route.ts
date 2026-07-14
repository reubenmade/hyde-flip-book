import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// Complete a password reset: validate the token (exists, unexpired, unused),
// set the new password, and consume the token.
export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const token = (body.token ?? "").toString();
  const password = (body.password ?? "").toString();

  if (!token || password.length < 8) {
    return NextResponse.json(
      { error: "A valid token and a password of at least 8 characters are required." },
      { status: 400 }
    );
  }

  const rows = (await sql`
    SELECT user_id FROM password_resets
    WHERE token = ${token} AND used_at IS NULL AND expires_at > now()
    LIMIT 1
  `) as { user_id: string }[];
  const reset = rows[0];
  if (!reset) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${reset.user_id}`;
  await sql`UPDATE password_resets SET used_at = now() WHERE token = ${token}`;

  return NextResponse.json({ ok: true });
}
