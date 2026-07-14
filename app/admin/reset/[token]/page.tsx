"use client";

import { use, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const welcome = useSearchParams().get("welcome") === "1";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/admin/login"), 1500);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not reset password.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl bg-paper border border-line p-8 shadow-sm">
        <div className="text-2xl font-semibold tracking-tight text-ink text-center">
          Flypp<span className="text-accent">Book</span>
        </div>
        <p className="mt-1 text-center text-sm text-muted">
          {welcome ? "Set your password to activate your account" : "Choose a new password"}
        </p>

        {done ? (
          <p className="mt-6 text-sm text-ink text-center">
            {welcome ? "Account activated." : "Password updated."} Redirecting to sign in…
          </p>
        ) : (
          <form onSubmit={submit}>
            <input
              type="password"
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="mt-6 w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none focus:border-accent"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="mt-3 w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none focus:border-accent"
            />
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Set password"}
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

export default function ResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return (
    <Suspense>
      <ResetForm token={token} />
    </Suspense>
  );
}
