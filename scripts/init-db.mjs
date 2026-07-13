// One-time (idempotent) schema setup. Run: `node --env-file=.env.local scripts/init-db.mjs`
// Not strictly required — the app also creates tables lazily on first use.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const sql = neon(url);

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
await sql`CREATE INDEX IF NOT EXISTS events_book_id_idx ON events(book_id)`;
await sql`CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at DESC)`;

console.log("✓ Schema ready.");
