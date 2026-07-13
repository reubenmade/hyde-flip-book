import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { sql, ensureSchema } from "@/lib/db";
import { dateTime, timeAgo } from "@/lib/format";
import { deviceOf } from "@/lib/device";
import { actionText } from "@/lib/activity";
import { SharePanel } from "./SharePanel";
import { DeleteButton } from "./DeleteButton";
import { AutoRefresh } from "../../AutoRefresh";

export const dynamic = "force-dynamic";

async function getData(id: string) {
  await ensureSchema();
  const bookRows = await sql`SELECT * FROM books WHERE id = ${id}`;
  if (bookRows.length === 0) return null;
  const book = bookRows[0];

  // Run the analytics queries concurrently.
  const [summaryRows, recipients, stream] = await Promise.all([
    sql`
      SELECT
        (SELECT COUNT(*) FROM events WHERE book_id = ${id} AND type = 'view') AS views,
        (SELECT MAX(max_depth) FROM events WHERE book_id = ${id}) AS deepest_page,
        (SELECT ROUND(AVG(sd)::numeric, 1) FROM (
            SELECT MAX(max_depth) AS sd FROM events
            WHERE book_id = ${id} AND max_depth IS NOT NULL
            GROUP BY session_id, recipient_id
         ) t) AS avg_depth
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
    // Chronological event stream — one row per open / new-depth milestone.
    sql`
      SELECT e.type, e.page, e.max_depth, e.created_at, e.user_agent,
             r.name AS recipient_name
      FROM events e
      LEFT JOIN recipients r ON r.id = e.recipient_id
      WHERE e.book_id = ${id}
      ORDER BY e.created_at DESC
      LIMIT 300
    `,
  ]);

  return { book, summary: summaryRows[0], recipients, stream };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();
  const { book, summary, recipients, stream } = data;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? `${proto}://${host}`;

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
            {book.page_count} pages · added {timeAgo(book.created_at)} ·{" "}
            <a
              href={`${origin}/b/${book.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Preview (untracked) ↗
            </a>
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
          {stream.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No opens yet. Add a recipient and share their link to start tracking.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {stream.map((e: Record<string, unknown>, i: number) => {
                const who = (e.recipient_name as string) || "Someone (direct link)";
                const isOpen = e.type === "view";
                return (
                  <li key={i} className="flex gap-3">
                    <div className="mt-1.5 flex flex-col items-center">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isOpen ? "bg-accent" : "bg-ink/30"
                        }`}
                      />
                      {i < stream.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-line" />
                      )}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm text-ink">
                        <span className="font-medium">{who}</span>{" "}
                        {actionText(e.type as string, e.page as number | null)}
                      </p>
                      <p className="text-xs text-muted">
                        {dateTime(e.created_at as string)} ·{" "}
                        {deviceOf(e.user_agent as string | null)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right: share */}
        <div className="order-1 lg:order-2">
          <SharePanel
            bookId={book.id}
            slug={book.slug}
            origin={origin}
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
