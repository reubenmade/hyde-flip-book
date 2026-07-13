import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { sql, ensureSchema } from "@/lib/db";
import { dateTime, timeAgo } from "@/lib/format";
import { deviceOf } from "@/lib/device";
import { SharePanel } from "./SharePanel";
import { DeleteButton } from "./DeleteButton";
import { AutoRefresh } from "../../AutoRefresh";

export const dynamic = "force-dynamic";

async function getData(id: string) {
  await ensureSchema();
  const bookRows = await sql`SELECT * FROM books WHERE id = ${id}`;
  if (bookRows.length === 0) return null;
  const book = bookRows[0];

  // Run the three analytics queries concurrently (one round trip, not three).
  const [summaryRows, recipients, activity] = await Promise.all([
    sql`
      SELECT
        COUNT(*) FILTER (WHERE type = 'view') AS views,
        COUNT(DISTINCT session_id)            AS sessions,
        MAX(max_depth)                        AS deepest_page,
        ROUND(AVG(max_depth)::numeric, 1)     AS avg_depth
      FROM events WHERE book_id = ${id}
    `,
    sql`
      SELECT
        r.id, r.name, r.token, r.created_at,
        COUNT(e.*) FILTER (WHERE e.type = 'view') AS views,
        MAX(e.max_depth)                          AS max_depth,
        MAX(e.created_at)                         AS last_seen
      FROM recipients r
      LEFT JOIN events e ON e.recipient_id = r.id
      WHERE r.book_id = ${id}
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `,
    sql`
      SELECT
        e.session_id,
        e.recipient_id,
        r.name          AS recipient_name,
        MIN(e.created_at) AS first_seen,
        MAX(e.created_at) AS last_seen,
        MAX(e.max_depth)  AS max_depth,
        MAX(e.user_agent) AS user_agent,
        MAX(e.country)    AS country
      FROM events e
      LEFT JOIN recipients r ON r.id = e.recipient_id
      WHERE e.book_id = ${id}
      GROUP BY e.session_id, e.recipient_id, r.name
      ORDER BY MAX(e.created_at) DESC
      LIMIT 500
    `,
  ]);

  return { book, summary: summaryRows[0], recipients, activity };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();
  const { book, summary, recipients, activity } = data;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? `${proto}://${host}`;
  const viewerBaseUrl = `${origin}/b/${book.slug}`;

  const pct =
    book.page_count > 0 && summary.avg_depth
      ? Math.round((Number(summary.avg_depth) / book.page_count) * 100)
      : 0;

  const stats = [
    { label: "Views", value: Number(summary.views ?? 0) },
    { label: "Recipients", value: recipients.length },
    {
      label: "Avg. depth",
      value: `${pct}%`,
      sub: summary.avg_depth ? `pg ${summary.avg_depth} / ${book.page_count}` : "—",
    },
    {
      label: "Deepest reached",
      value: summary.deepest_page ? `pg ${summary.deepest_page}` : "—",
    },
  ];

  return (
    <div>
      <AutoRefresh />
      <Link href="/admin" className="text-sm text-muted hover:text-ink">
        ← All books
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{book.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {book.client_name ? `${book.client_name} · ` : ""}
            {book.page_count} pages · added {timeAgo(book.created_at)}
          </p>
        </div>
        <DeleteButton id={book.id} title={book.title} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: analytics */}
        <div className="order-2 lg:order-1">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-paper p-4">
                <div className="text-2xl font-semibold text-ink">{s.value}</div>
                <div className="text-xs text-muted mt-0.5">{s.label}</div>
                {s.sub && <div className="text-[11px] text-muted/70">{s.sub}</div>}
              </div>
            ))}
          </div>

          <h2 className="mt-8 font-semibold text-ink">Activity</h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No opens yet. Add a recipient and share their link to start tracking.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper text-left text-xs uppercase text-muted">
                    <th className="px-4 py-2.5 font-medium">Who</th>
                    <th className="px-4 py-2.5 font-medium">Reached</th>
                    <th className="px-4 py-2.5 font-medium">Device</th>
                    <th className="px-4 py-2.5 font-medium">Last opened</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a: Record<string, unknown>, i: number) => {
                    const depth = Number(a.max_depth ?? 0);
                    const dpct = book.page_count
                      ? Math.round((depth / book.page_count) * 100)
                      : 0;
                    const who = (a.recipient_name as string) || "Direct link";
                    return (
                      <tr key={i} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink">{who}</div>
                          {!a.recipient_name && (
                            <div className="text-xs text-muted">no name attached</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                              <div
                                className="h-full bg-accent"
                                style={{ width: `${dpct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted">
                              pg {depth}/{book.page_count}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {deviceOf(a.user_agent as string | null)}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {dateTime(a.last_seen as string)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: share */}
        <div className="order-1 lg:order-2">
          <SharePanel
            bookId={book.id}
            slug={book.slug}
            viewerBaseUrl={viewerBaseUrl}
            shareImageUrl={book.share_url}
            title={book.title}
            client={book.client_name}
            pageCount={book.page_count}
            initialRecipients={recipients}
          />
        </div>
      </div>
    </div>
  );
}
