import Link from "next/link";
import { sql, ensureSchema } from "@/lib/db";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  page_count: number;
  cover_url: string | null;
  status: string;
  created_at: string;
  views: number;
  sessions: number;
  last_view: string | null;
};

async function getBooks(): Promise<Row[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT
      b.id, b.slug, b.title, b.client_name, b.page_count,
      b.cover_url, b.status, b.created_at,
      COALESCE(v.views, 0)    AS views,
      COALESCE(v.sessions, 0) AS sessions,
      v.last_view
    FROM books b
    LEFT JOIN (
      SELECT book_id,
             COUNT(*) FILTER (WHERE type = 'view') AS views,
             COUNT(DISTINCT session_id)            AS sessions,
             MAX(created_at)                       AS last_view
      FROM events GROUP BY book_id
    ) v ON v.book_id = b.id
    ORDER BY b.created_at DESC
  `;
  return rows as Row[];
}

export default async function AdminDashboard() {
  const books = await getBooks();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Flip books</h1>
          <p className="text-sm text-muted mt-1">
            {books.length} {books.length === 1 ? "book" : "books"}
          </p>
        </div>
        <Link
          href="/admin/upload"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          + New flip book
        </Link>
      </div>

      {books.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center">
          <p className="text-muted">No flip books yet.</p>
          <Link
            href="/admin/upload"
            className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
          >
            Upload your first PDF
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {books.map((b) => (
            <Link
              key={b.id}
              href={`/admin/book/${b.id}`}
              className="group flex items-center gap-4 rounded-xl border border-line bg-paper p-3 transition hover:border-accent/50 hover:shadow-sm"
            >
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-line/50">
                {b.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.cover_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    …
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-ink">{b.title}</span>
                  {b.status !== "ready" && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                      {b.status}
                    </span>
                  )}
                </div>
                <div className="truncate text-sm text-muted">
                  {b.page_count} pages
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-ink">{b.views} views</div>
                <div className="text-xs text-muted">
                  {b.sessions} {b.sessions === 1 ? "visitor" : "visitors"}
                </div>
              </div>
              <div className="hidden md:block w-24 text-right text-xs text-muted">
                {b.last_view ? timeAgo(b.last_view) : "No views"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
