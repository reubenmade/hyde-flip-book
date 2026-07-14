import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { sql, ensureSchema, type UserRow } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { deleteObjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

async function gateSuper() {
  const session = await getSession();
  if (!session) return { res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (session.role !== "super") return { res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { session };
}

// Reset a user's password. Superuser only. If no password is supplied a random
// temporary one is generated and returned so it can be shared with the user.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const gate = await gateSuper();
  if (gate.res) return gate.res;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  let password = (body.password ?? "").toString();
  let generated: string | null = null;
  if (!password) {
    generated = nanoid(12);
    password = generated;
  } else if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  const rows = await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${id} RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, tempPassword: generated });
}

// Delete a user and cascade-delete their books (with stored blobs). Superuser
// only. Superuser accounts can't be deleted here.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const gate = await gateSuper();
  if (gate.res) return gate.res;

  const { id } = await params;
  if (id === gate.session.uid) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const target = (await sql`SELECT role FROM users WHERE id = ${id}`) as Pick<UserRow, "role">[];
  if (target.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (target[0].role === "super") {
    return NextResponse.json({ error: "Superuser accounts can't be deleted." }, { status: 400 });
  }

  // Collect and remove stored blobs for all of this user's books.
  const books = (await sql`
    SELECT pages, cover_url, share_url FROM books WHERE owner_id = ${id}
  `) as { pages: string[] | null; cover_url: string | null; share_url: string | null }[];
  const urls = books
    .flatMap((b) => [...(b.pages ?? []), b.cover_url, b.share_url])
    .filter(Boolean) as string[];
  if (urls.length) await deleteObjects(urls);

  // books → events/recipients cascade via their FKs.
  await sql`DELETE FROM books WHERE owner_id = ${id}`;
  await sql`DELETE FROM users WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
