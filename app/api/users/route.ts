import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { sql, ensureSchema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listUsersWithStats } from "@/lib/analytics";
import { sendInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

async function gateSuper() {
  const session = await getSession();
  if (!session) return { res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (session.role !== "super") return { res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { session };
}

// List all users with per-user usage analytics. Superuser only.
export async function GET() {
  await ensureSchema();
  const gate = await gateSuper();
  if (gate.res) return gate.res;

  const users = await listUsersWithStats();
  return NextResponse.json({ users });
}

// Create a new user. Superuser only.
export async function POST(req: Request) {
  await ensureSchema();
  const gate = await gateSuper();
  if (gate.res) return gate.res;

  const body = await req.json().catch(() => ({}));
  const username = (body.username ?? "").toString().trim();
  const email = (body.email ?? "").toString().trim();
  const password = (body.password ?? "").toString();

  if (!username) return NextResponse.json({ error: "Username is required." }, { status: 400 });

  // Two modes: set a password now, or (no password) email an invite so the user
  // sets their own. Invites require an email to send the link to.
  const invite = password.length === 0;
  if (invite && !email) {
    return NextResponse.json(
      { error: "Provide a password, or an email address to send an invite to." },
      { status: 400 }
    );
  }
  if (!invite && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing.length > 0) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  // For invites, store an unusable random password until they set their own.
  const hash = await bcrypt.hash(invite ? nanoid(32) : password, 10);
  const rows = await sql`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (${username}, ${email || null}, ${hash}, 'user')
    RETURNING id, username, email, role, created_at, last_login_at
  `;
  const user = rows[0];

  if (invite) {
    const token = nanoid(32);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await sql`
      INSERT INTO password_resets (token, user_id, expires_at)
      VALUES (${token}, ${user.id}, ${expires.toISOString()})
    `;
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? `${proto}://${host}`;
    await sendInviteEmail(email, `${origin}/admin/reset/${token}?welcome=1`, username);
  }

  return NextResponse.json({ user, invited: invite });
}
