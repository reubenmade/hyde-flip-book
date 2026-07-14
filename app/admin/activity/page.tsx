import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { deviceOf } from "@/lib/device";
import { actionText } from "@/lib/activity";
import { AutoRefresh } from "../AutoRefresh";

export const dynamic = "force-dynamic";

async function getStream(uid: string, all: boolean) {
  await ensureSchema();
  return sql`
    SELECT e.type, e.page, e.created_at, e.user_agent,
           b.id AS book_id, b.title AS book_title,
           r.name AS recipient_name
    FROM events e
    JOIN books b ON b.id = e.book_id
    LEFT JOIN recipients r ON r.id = e.recipient_id
    WHERE ${all} OR b.owner_id = ${uid}
    ORDER BY e.created_at DESC
    LIMIT 500
  `;
}

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const stream = await getStream(session.uid, session.role === "super");

  return (
    <div>
      <AutoRefresh />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">All activity</h1>
          <p className="text-sm text-muted mt-1">
            Every open and page-depth milestone across{" "}
            {session.role === "super" ? "all" : "your"} documents, live.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-muted hover:text-ink">
          ← All books
        </Link>
      </div>

      {stream.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center text-muted">
          No activity yet.
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
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
                    {actionText(e.type as string, e.page as number | null)} on{" "}
                    <Link
                      href={`/admin/book/${e.book_id}`}
                      className="text-accent hover:underline"
                    >
                      {e.book_title as string}
                    </Link>
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
  );
}
