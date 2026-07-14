import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { newSlug } from "@/lib/slug";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// List books with lightweight analytics. Scoped to the caller; superusers see all.
export async function GET() {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const all = session.role === "super";

  const rows = await sql`
    SELECT
      b.id, b.slug, b.title, b.client_name, b.page_count,
      b.cover_url, b.status, b.created_at,
      COALESCE(v.views, 0)      AS views,
      COALESCE(v.sessions, 0)   AS sessions,
      v.last_view
    FROM books b
    LEFT JOIN (
      SELECT book_id,
             COUNT(*) FILTER (WHERE type = 'view')      AS views,
             COUNT(DISTINCT session_id)                 AS sessions,
             MAX(created_at)                            AS last_view
      FROM events
      GROUP BY book_id
    ) v ON v.book_id = b.id
    WHERE ${all} OR b.owner_id = ${session.uid}
    ORDER BY b.created_at DESC
  `;
  return NextResponse.json({ books: rows });
}

// Create a draft book (metadata only), owned by the caller. Images are attached
// later via /finalize.
export async function POST(req: Request) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role === "super") {
    return NextResponse.json(
      { error: "Superusers manage accounts and don't create flip books." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const title = (body.title ?? "").toString().trim();
  const clientName = (body.clientName ?? "").toString().trim();

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const slug = newSlug();
  const rows = await sql`
    INSERT INTO books (slug, title, client_name, status, owner_id)
    VALUES (${slug}, ${title}, ${clientName}, 'draft', ${session.uid})
    RETURNING id, slug
  `;
  return NextResponse.json({ book: rows[0] });
}
