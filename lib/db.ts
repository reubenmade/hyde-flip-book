import { Pool } from "pg";

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
  created_at: string;
};
