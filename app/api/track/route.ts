import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

function hashIp(ip: string): string {
  return createHash("sha256")
    .update(ip + (process.env.SESSION_SECRET ?? ""))
    .digest("hex")
    .slice(0, 16);
}

// Public analytics beacon from the viewer. One row per meaningful event.
export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => ({}));

  const slug = (body.slug ?? "").toString();
  const sessionId = (body.sessionId ?? "").toString().slice(0, 64);
  const type = (body.type ?? "").toString();
  if (!slug || !sessionId || !["view", "progress"].includes(type)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const book = await sql`SELECT id FROM books WHERE slug = ${slug} AND status = 'ready'`;
  if (book.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const bookId = book[0].id;

  // Resolve the named recipient from the link token, if present.
  let recipientId: string | null = null;
  const token = (body.token ?? "").toString().slice(0, 32);
  if (token) {
    const rec = await sql`SELECT id FROM recipients WHERE token = ${token} AND book_id = ${bookId}`;
    if (rec.length > 0) recipientId = rec[0].id;
  }

  const page = Number.isFinite(body.page) ? Math.trunc(body.page) : null;
  const maxDepth = Number.isFinite(body.maxDepth) ? Math.trunc(body.maxDepth) : page;

  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || "unknown";
  const ipHash = hashIp(ip);
  const country = req.headers.get("x-vercel-ip-country") ?? null;
  const referrer = (body.referrer ?? req.headers.get("referer") ?? "").toString().slice(0, 300) || null;
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300) || null;

  await sql`
    INSERT INTO events (book_id, recipient_id, session_id, type, page, max_depth, referrer, user_agent, ip_hash, country)
    VALUES (${bookId}, ${recipientId}, ${sessionId}, ${type}, ${page}, ${maxDepth}, ${referrer}, ${ua}, ${ipHash}, ${country})
  `;

  return NextResponse.json({ ok: true });
}
