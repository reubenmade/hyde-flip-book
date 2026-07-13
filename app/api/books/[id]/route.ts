import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { deleteObjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Full book detail + analytics for the admin book page.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;

  const bookRows = await sql`SELECT * FROM books WHERE id = ${id}`;
  if (bookRows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const book = bookRows[0];

  const summary = await sql`
    SELECT
      COUNT(*) FILTER (WHERE type = 'view')    AS views,
      COUNT(DISTINCT session_id)               AS sessions,
      MAX(max_depth)                           AS deepest_page,
      ROUND(AVG(max_depth)::numeric, 1)        AS avg_depth,
      MAX(created_at)                          AS last_view
    FROM events WHERE book_id = ${id}
  `;

  // Per-session rollup for the activity log.
  const activity = await sql`
    SELECT
      session_id,
      MIN(created_at)                          AS first_seen,
      MAX(created_at)                          AS last_seen,
      MAX(max_depth)                           AS max_depth,
      MAX(referrer)                            AS referrer,
      MAX(country)                             AS country
    FROM events
    WHERE book_id = ${id}
    GROUP BY session_id
    ORDER BY MAX(created_at) DESC
    LIMIT 500
  `;

  return NextResponse.json({ book, summary: summary[0], activity });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;

  const rows = await sql`SELECT pages, cover_url, share_url FROM books WHERE id = ${id}`;
  if (rows.length > 0) {
    const urls = [
      ...((rows[0].pages as string[]) ?? []),
      rows[0].cover_url,
      rows[0].share_url,
    ].filter(Boolean) as string[];
    if (urls.length) {
      await deleteObjects(urls);
    }
  }
  await sql`DELETE FROM books WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
