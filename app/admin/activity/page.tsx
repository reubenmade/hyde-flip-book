import Link from "next/link";
import { sql, ensureSchema } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { deviceOf } from "@/lib/device";

export const dynamic = "force-dynamic";

async function getActivity() {
  await ensureSchema();
  // One row per (book, recipient, session/device), newest first.
  return sql`
    SELECT
      b.id AS book_id, b.title AS book_title, b.page_count,
      e.recipient_id, r.name AS recipient_name,
      e.session_id,
      MAX(e.max_depth)  AS max_depth,
      MAX(e.created_at) AS last_seen,
      MAX(e.user_agent) AS user_agent
    FROM events e
    JOIN books b ON b.id = e.book_id
    LEFT JOIN recipients r ON r.id = e.recipient_id
    GROUP BY b.id, b.title, b.page_count, e.recipient_id, r.name, e.session_id
    ORDER BY MAX(e.created_at) DESC
    LIMIT 500
  `;
}

export default async function ActivityPage() {
  const rows = await getActivity();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">All activity</h1>
          <p className="text-sm text-muted mt-1">
            Every open across all documents and recipients, most recent first.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-muted hover:text-ink">
          ← All books
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center text-muted">
          No activity yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs uppercase text-muted">
                <th className="px-4 py-2.5 font-medium">Who</th>
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Reached</th>
                <th className="px-4 py-2.5 font-medium">Device</th>
                <th className="px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a: Record<string, unknown>, i: number) => {
                const depth = Number(a.max_depth ?? 0);
                const pageCount = Number(a.page_count ?? 0);
                const dpct = pageCount ? Math.round((depth / pageCount) * 100) : 0;
                const who = (a.recipient_name as string) || "Direct link";
                return (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{who}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/book/${a.book_id}`}
                        className="text-accent hover:underline"
                      >
                        {a.book_title as string}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                          <div className="h-full bg-accent" style={{ width: `${dpct}%` }} />
                        </div>
                        <span className="text-xs text-muted">
                          pg {depth}/{pageCount}
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
  );
}
