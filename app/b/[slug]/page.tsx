import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { sql, ensureSchema } from "@/lib/db";
import { ViewerClient } from "./ViewerClient";

export const dynamic = "force-dynamic";

async function getBook(slug: string) {
  await ensureSchema();
  const rows = await sql`
    SELECT slug, title, client_name, page_count, share_url
    FROM books WHERE slug = ${slug} AND status = 'ready'
  `;
  return rows[0] ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) return { title: "Not found" };
  return {
    title: `${book.title} — Hyde`,
    description: book.client_name
      ? `A flip book prepared for ${book.client_name}.`
      : "A flip book by Hyde.",
    openGraph: {
      title: book.title,
      images: book.share_url ? [book.share_url] : undefined,
    },
    robots: { index: false, follow: false },
  };
}

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const book = await getBook(slug);
  if (!book) notFound();

  return (
    <ViewerClient
      slug={book.slug}
      title={book.title}
      pageCount={book.page_count}
      token={t ?? null}
    />
  );
}
