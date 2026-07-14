import { getSession, type Session } from "@/lib/auth";
import { sql } from "@/lib/db";

/**
 * Returns the caller's session if they may access the given book — they own it,
 * or they're a superuser. Returns null when there's no session, the book
 * doesn't exist, or it belongs to someone else. Callers map null → 404 so that
 * "not yours" is indistinguishable from "not found".
 */
export async function authorizeBook(id: string): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  const rows = (await sql`SELECT owner_id FROM books WHERE id = ${id}`) as {
    owner_id: string | null;
  }[];
  if (rows.length === 0) return null;
  if (session.role !== "super" && rows[0].owner_id !== session.uid) return null;
  return session;
}
