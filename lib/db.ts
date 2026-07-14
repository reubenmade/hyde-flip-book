import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not set. Database calls will fail until it is configured.");
}

// A tagged-template `sql` that returns an array of rows, so route/query code is
// concise. Backed by node-postgres, which works with local Postgres, Supabase,
// Neon, or any standard Postgres — on Vercel's Node (Fluid) runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

const isLocal =
  !connectionString ||
  /(@|\/\/)(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString);

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString ?? undefined,
      // Managed Postgres (Supabase/Neon/etc.) requires TLS; local does not.
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export const sql: SqlTag = async (strings, ...values) => {
  let text = "";
  strings.forEach((part, i) => {
    text += part + (i < values.length ? `$${i + 1}` : "");
  });
  const res = await getPool().query(text, values as unknown[]);
  return res.rows;
};

let schemaReady: Promise<void> | null = null;

/**
 * Idempotently ensures the database schema exists. Cached per server instance so
 * the CREATE statements only run once per cold start.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      // ── Users & auth ───────────────────────────────────────────────────
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          username      text UNIQUE NOT NULL,
          email         text,
          password_hash text NOT NULL,
          role          text NOT NULL DEFAULT 'user',
          created_at    timestamptz NOT NULL DEFAULT now(),
          last_login_at timestamptz
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS password_resets (
          token       text PRIMARY KEY,
          user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at  timestamptz NOT NULL,
          used_at     timestamptz
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS books (
          id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          slug          text UNIQUE NOT NULL,
          title         text NOT NULL,
          client_name   text NOT NULL DEFAULT '',
          page_count    integer NOT NULL DEFAULT 0,
          pages         jsonb NOT NULL DEFAULT '[]'::jsonb,
          cover_url     text,
          share_url     text,
          status        text NOT NULL DEFAULT 'draft',
          created_at    timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS recipients (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          book_id     uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          name        text NOT NULL,
          token       text UNIQUE NOT NULL,
          created_at  timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS events (
          id          bigserial PRIMARY KEY,
          book_id     uuid REFERENCES books(id) ON DELETE CASCADE,
          session_id  text NOT NULL,
          type        text NOT NULL,
          page        integer,
          max_depth   integer,
          referrer    text,
          user_agent  text,
          ip_hash     text,
          country     text,
          created_at  timestamptz NOT NULL DEFAULT now()
        )
      `;
      // Added after initial release — safe on existing databases.
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS recipient_id uuid`;
      await sql`CREATE INDEX IF NOT EXISTS events_book_id_idx ON events(book_id)`;
      await sql`CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS events_recipient_id_idx ON events(recipient_id)`;
      await sql`CREATE INDEX IF NOT EXISTS recipients_book_id_idx ON recipients(book_id)`;

      // ── Per-user ownership (multi-tenant) ──────────────────────────────
      await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS owner_id uuid`;
      await sql`CREATE INDEX IF NOT EXISTS books_owner_id_idx ON books(owner_id)`;

      // Bootstrap / refresh the superuser from environment variables. The env
      // is the source of truth for this account, so we upsert on every cold
      // start — changing SUPERUSER_PASSWORD in the environment rotates it.
      const superUsername = process.env.SUPERUSER_USERNAME;
      const superPassword = process.env.SUPERUSER_PASSWORD;
      if (superUsername && superPassword) {
        const hash = await bcrypt.hash(superPassword, 10);
        await sql`
          INSERT INTO users (username, email, password_hash, role)
          VALUES (${superUsername}, ${process.env.SUPERUSER_EMAIL ?? null}, ${hash}, 'super')
          ON CONFLICT (username) DO UPDATE
            SET password_hash = EXCLUDED.password_hash,
                email         = EXCLUDED.email,
                role          = 'super'
        `;
      }
      // Note: the superuser never owns books — it exists only to manage users
      // and view usage. Pre-existing books stay unassigned (owner_id NULL) and
      // are surfaced to the superuser as unassigned oversight.
    })();
  }
  return schemaReady;
}

export type BookRow = {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  page_count: number;
  pages: string[];
  cover_url: string | null;
  share_url: string | null;
  status: string;
  owner_id: string | null;
  created_at: string;
};

export type UserRow = {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  role: "user" | "super";
  created_at: string;
  last_login_at: string | null;
};
