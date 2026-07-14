"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      // Full-document navigation so the freshly set session cookie flows through
      // middleware and the destination renders authenticated. A client-side
      // router.push here can race the cookie and bounce back to /login.
      window.location.assign(params.get("next") || "/admin");
      return;
    }
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    setError(data.error || "Login failed.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-paper border border-line p-8 shadow-sm"
      >
        <div className="text-2xl font-semibold tracking-tight text-ink text-center">
          Flypp<span className="text-accent">Book</span>
        </div>
        <p className="mt-1 text-center text-sm text-muted">Sign in</p>

        <input
          type="text"
          autoFocus
          autoCapitalize="none"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="mt-6 w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none focus:border-accent"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-3 w-full rounded-lg border border-line bg-white px-4 py-3 text-ink outline-none focus:border-accent"
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-center text-sm">
          <Link href="/admin/forgot" className="text-muted hover:text-ink transition">
            Forgot password?
          </Link>
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
