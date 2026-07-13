import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { newSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

// Add a named recipient to a book. Returns a unique token → the personalized link.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").toString().trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const book = await sql`SELECT id FROM books WHERE id = ${id}`;
  if (book.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const token = newSlug();
  const rows = await sql`
    INSERT INTO recipients (book_id, name, token)
    VALUES (${id}, ${name}, ${token})
    RETURNING id, name, token, created_at
  `;
  return NextResponse.json({ recipient: rows[0] });
}
