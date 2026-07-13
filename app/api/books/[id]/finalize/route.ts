import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// Called after the browser has rendered + uploaded all page/cover/share images.
// Attaches the resulting blob URLs and marks the book ready.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const pages: string[] = Array.isArray(body.pages) ? body.pages : [];
  const coverUrl: string | null = body.coverUrl ?? pages[0] ?? null;
  const shareUrl: string | null = body.shareUrl ?? null;

  if (pages.length === 0) {
    return NextResponse.json({ error: "No pages provided." }, { status: 400 });
  }

  const rows = await sql`
    UPDATE books
    SET pages = ${JSON.stringify(pages)}::jsonb,
        page_count = ${pages.length},
        cover_url = ${coverUrl},
        share_url = ${shareUrl},
        status = 'ready'
    WHERE id = ${id}
    RETURNING id, slug
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ book: rows[0] });
}
