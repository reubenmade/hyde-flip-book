import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { sql, ensureSchema } from "@/lib/db";
import { ViewerClient } from "../../b/[slug]/ViewerClient";

export const dynamic = "force-dynamic";

// A single clean per-recipient link: /v/<token>. The token resolves to both the
// document and the named recipient, so there's no query-string "tracking" look.
async function getByToken(token: string) {
  await ensureSchema();
  const rows = await sql`
    SELECT b.slug, b.title, b.page_count, b.share_url, r.token
    FROM recipients r
    JOIN books b ON b.id = r.book_id
    WHERE r.token = ${token} AND b.status = 'ready'
  `;
  return rows[0] ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const book = await getByToken(token);
  if (!book) return { title: "Not found" };
  return {
    title: `${book.title} — Hyde`,
    openGraph: {
      title: book.title,
      images: book.share_url ? [book.share_url] : undefined,
    },
    robots: { index: false, follow: false },
  };
}

export default async function TokenViewerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const book = await getByToken(token);
  if (!book) notFound();

  return (
    <ViewerClient
      slug={book.slug}
      title={book.title}
      pageCount={book.page_count}
      token={token}
    />
  );
}
