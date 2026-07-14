import { sql } from "@/lib/db";

export type UserStats = {
  id: string;
  username: string;
  email: string | null;
  role: "user" | "super";
  created_at: string;
  last_login_at: string | null;
  files: number;
  views: number;
  links_30d: number;
};

/** All users with per-user usage analytics, for the superuser dashboard. */
export async function listUsersWithStats(): Promise<UserStats[]> {
  const rows = await sql`
    SELECT
      u.id, u.username, u.email, u.role, u.created_at, u.last_login_at,
      COALESCE(bk.files, 0)      AS files,
      COALESCE(bk.views, 0)      AS views,
      COALESCE(lk.links_30d, 0)  AS links_30d
    FROM users u
    LEFT JOIN (
      SELECT b.owner_id,
             COUNT(DISTINCT b.id)                     AS files,
             COUNT(*) FILTER (WHERE e.type = 'view')  AS views
      FROM books b
      LEFT JOIN events e ON e.book_id = b.id
      GROUP BY b.owner_id
    ) bk ON bk.owner_id = u.id
    LEFT JOIN (
      SELECT b.owner_id, COUNT(*) AS links_30d
      FROM recipients r
      JOIN books b ON b.id = r.book_id
      WHERE r.created_at > now() - interval '30 days'
      GROUP BY b.owner_id
    ) lk ON lk.owner_id = u.id
    ORDER BY (u.role = 'super') DESC, u.created_at ASC
  `;
  return rows.map((r) => ({
    ...r,
    files: Number(r.files),
    views: Number(r.views),
    links_30d: Number(r.links_30d),
  })) as UserStats[];
}
