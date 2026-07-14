import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listUsersWithStats } from "@/lib/analytics";
import { UsersManager } from "./UsersManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await ensureSchema();
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "super") redirect("/admin");

  const users = await listUsersWithStats();

  const totals = {
    users: users.length,
    files: users.reduce((n, u) => n + u.files, 0),
    links30d: users.reduce((n, u) => n + u.links_30d, 0),
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Users</h1>
          <p className="text-sm text-muted mt-1">
            {totals.users} {totals.users === 1 ? "user" : "users"} ·{" "}
            {totals.files} total files · {totals.links30d} links in the last 30 days
          </p>
        </div>
        <Link href="/admin" className="text-sm text-muted hover:text-ink transition">
          ← All books
        </Link>
      </div>

      <UsersManager initialUsers={users} currentUserId={session.uid} />
    </div>
  );
}
