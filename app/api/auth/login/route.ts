import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql, ensureSchema, type UserRow } from "@/lib/db";
import { createSessionToken, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureSchema();
  const { username, password } = await req
    .json()
    .catch(() => ({ username: "", password: "" }));

  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const rows = (await sql`
    SELECT id, username, password_hash, role FROM users WHERE username = ${username.trim()}
  `) as Pick<UserRow, "id" | "username" | "password_hash" | "role">[];

  const user = rows[0];
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;

  const token = await createSessionToken({
    uid: user.id,
    username: user.username,
    role: user.role,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
