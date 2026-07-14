# FlyppBook

Upload a PDF, note the client, and get a polished, trackable online flip book
plus a one-click "Copy for Gmail" share block. Built to run on **free tiers**.

Multi-user: each account sees only its own books, share links and activity. A
**superuser** (bootstrapped from env vars) manages accounts and sees usage
analytics across everyone.

## How it works

- **Upload** (admin): the PDF is rendered to per-page WebP images **in your
  browser** (pdf.js). The original PDF is never uploaded or hosted, so there's
  nothing straightforward for a client to download.
- **Storage**: page images live in **Vercel Blob**; book metadata + analytics in
  **Neon Postgres**. Page images are streamed to viewers through
  `/api/book/<slug>/page/<n>`, so the real storage URLs are never exposed.
- **Viewer** (`/b/<slug>`): a real page-curl flip book (`page-flip`) — two-page
  spread on desktop, single page on mobile.
- **Sharing**: the admin book page renders a book-styled email thumbnail and a
  **Copy for Gmail** button that puts a clickable image + link on your clipboard.
  (Email clients strip JS/iframes, so the live flip can't run *inside* the email —
  the image links out to the full experience. This is the richest thing Gmail keeps.)
- **Analytics**: every view and the deepest page reached is recorded per visitor;
  see it on each book's page.

## Tech

Next.js 16 (App Router) · Neon Postgres · Vercel Blob · pdf.js · page-flip · jose.

## Local development

1. `cp .env.example .env.local` and fill in the required values (including the
   `SUPERUSER_*` credentials you'll first sign in with).
2. (Optional) `node --env-file=.env.local scripts/init-db.mjs` to create tables
   up front — the app also creates them lazily on first use.
3. `npm run dev` → http://localhost:3000

## Deploy to Vercel (free)

1. **Neon**: Vercel dashboard → Storage → create a Neon Postgres store. Copy the
   pooled connection string into `DATABASE_URL`.
2. **Blob**: Vercel dashboard → Storage → create a Blob store (auto-wires
   `BLOB_READ_WRITE_TOKEN` in the project).
3. **Env vars**: set `SESSION_SECRET` (`openssl rand -base64 32`),
   `SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD` / `SUPERUSER_EMAIL`, and
   (optionally) `RESEND_API_KEY` / `RESEND_FROM` for password-reset emails, in
   Project → Settings → Environment Variables.
4. Push the repo and import it in Vercel, or run `vercel --prod`.

### Cost at ~300 PDFs/year

Comfortably within free tiers. ~300 books × ~20 pages × ~120 KB ≈ **~700 MB** of
Blob (free tier is 1 GB+), Neon rows are tiny, and traffic is low. Expected: **$0**.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string (Supabase/Neon/local) |
| `BLOB_READ_WRITE_TOKEN` | ✅ | Vercel Blob (auto on Vercel) |
| `SESSION_SECRET` | ✅ | Signs session cookie + hashes visitor IPs |
| `SUPERUSER_USERNAME` | ✅ | Superuser login (manages all accounts) |
| `SUPERUSER_PASSWORD` | ✅ | Superuser password (env is source of truth) |
| `SUPERUSER_EMAIL` | — | Superuser email (for password resets) |
| `RESEND_API_KEY` | — | Resend key for reset emails (else logged to console) |
| `RESEND_FROM` | — | From address for reset emails |
| `NEXT_PUBLIC_BASE_URL` | — | Override share-/reset-link origin |

## Notes on "not downloadable"

This is deliberately *light* protection, per the brief: no raw PDF is ever
served; images are proxied (real Blob URLs hidden); right-click and image drag
are disabled in the viewer. A determined user can still screenshot — that's fine.
