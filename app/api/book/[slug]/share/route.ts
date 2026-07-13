import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// Streams the book's share image from the same origin, so the browser can fetch
// it (no cross-origin CORS issues) and inline it as a data URI in the Gmail snippet.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  await ensureSchema();
  const { slug } = await params;
  const rows = await sql`SELECT share_url FROM books WHERE slug = ${slug} AND status = 'ready'`;
  if (rows.length === 0 || !rows[0].share_url) {
    return new Response("Not found", { status: 404 });
  }
  const upstream = await fetch(rows[0].share_url as string);
  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream error", { status: 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
