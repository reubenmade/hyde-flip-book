import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { authorizeBook } from "@/lib/access";

export const dynamic = "force-dynamic";

// Updates a book's share/preview image URL after the browser regenerates it.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  if (!(await authorizeBook(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const shareUrl = (body.shareUrl ?? "").toString();
  if (!shareUrl) {
    return NextResponse.json({ error: "shareUrl required" }, { status: 400 });
  }
  const rows = await sql`
    UPDATE books SET share_url = ${shareUrl} WHERE id = ${id} RETURNING id
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
