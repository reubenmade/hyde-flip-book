import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// Streams an individual page image to the viewer WITHOUT exposing the underlying
// blob URL. This is the "not straightforward to download" layer: clients only
// ever see /api/book/<slug>/page/<n>, never the real storage location.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; n: string }> }
) {
  await ensureSchema();
  const { slug, n } = await params;
  const index = parseInt(n, 10);

  const rows = await sql`SELECT pages FROM books WHERE slug = ${slug} AND status = 'ready'`;
  if (rows.length === 0) return new Response("Not found", { status: 404 });

  const pages = (rows[0].pages as string[]) ?? [];
  if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(pages[index]);
  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream error", { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/webp",
      // Cache in the browser but discourage indexing/hotlinking.
      "Cache-Control": "private, max-age=86400",
      "Content-Disposition": "inline",
      "X-Robots-Tag": "noindex",
    },
  });
}
