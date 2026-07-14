"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPage() {
  const [identifier, setIdentifier] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/reset-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier }),
    });
    setLoading(false);
    setDone(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl bg-paper border border-line p-8 shadow-sm">
        <div className="text-2xl font-semibold tracking-tight text-ink text-center">
          Flypp<span className="text-accent">Book</span>
        </div>
        <p className="mt-1 text-center text-sm text-muted">Reset password</p>

        {done ? (
          <p className="mt-6 text-sm text-ink text-center">
            If an account matches, a reset link has been sent to its email
            address. Check your inbox.
          </p>
        ) : (
          <form onSubmit={submit}>
            <input
              type="text"
              autoFocus
              autoCapitalize="none"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Username or email"
              className="mt-6 w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading || !identifier.trim()}
              className="mt-4 w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm">
          <Link href="/admin/login" className="text-muted hover:text-ink transition">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
