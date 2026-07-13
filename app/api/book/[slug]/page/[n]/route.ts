import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Small per-instance cache of slug → page URLs. A "ready" book's pages never
// change, so this removes the per-image DB round trip (big deal cross-region).
const pagesCache = new Map<string, { pages: string[]; exp: number }>();
const TTL = 10 * 60 * 1000;

async function getPages(slug: string): Promise<string[] | null> {
  const hit = pagesCache.get(slug);
  if (hit && hit.exp > Date.now()) return hit.pages;
  const rows = await sql`SELECT pages FROM books WHERE slug = ${slug} AND status = 'ready'`;
  if (rows.length === 0) return null;
  const pages = (rows[0].pages as string[]) ?? [];
  pagesCache.set(slug, { pages, exp: Date.now() + TTL });
  return pages;
}

// Streams a page image WITHOUT exposing the underlying blob URL. Responses are
// immutable + edge-cacheable, so after the first fetch each image is served from
// Vercel's CDN — the function and DB are not touched again.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; n: string }> }
) {
  const { slug, n } = await params;
  const index = parseInt(n, 10);

  const pages = await getPages(slug);
  if (!pages) return new Response("Not found", { status: 404 });
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
      // Immutable content → cache hard at the browser AND the Vercel edge.
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "Content-Disposition": "inline",
      "X-Robots-Tag": "noindex",
    },
  });
}
