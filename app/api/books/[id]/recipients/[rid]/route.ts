import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// Remove a recipient. Their past activity is kept but detaches (recipient_id
// stays, name is no longer joinable → shows as removed).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  await ensureSchema();
  const { id, rid } = await params;
  await sql`DELETE FROM recipients WHERE id = ${rid} AND book_id = ${id}`;
  return NextResponse.json({ ok: true });
}
