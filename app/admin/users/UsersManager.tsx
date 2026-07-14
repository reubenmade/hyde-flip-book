"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/format";
import type { UserStats } from "@/lib/analytics";

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserStats[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      const name = username;
      const to = email;
      setUsername("");
      setEmail("");
      setPassword("");
      setCreating(false);
      setNotice(
        data.invited
          ? `Invite sent to ${to} — ${name} will set their own password.`
          : `Created ${name}.`
      );
      router.refresh();
    } else {
      setError(data.error || "Could not create user.");
    }
  }

  async function resetPassword(id: string, name: string) {
    setError("");
    setNotice("");
    const res = await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setNotice(`New temporary password for ${name}: ${data.tempPassword} — share it securely.`);
    } else {
      setError(data.error || "Could not reset password.");
    }
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Delete ${name} and all of their books? This can't be undone.`)) return;
    setError("");
    setNotice("");
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNotice(`Deleted ${name}.`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not delete user.");
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            setCreating((v) => !v);
            setError("");
            setNotice("");
          }}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          {creating ? "Cancel" : "+ New user"}
        </button>
      </div>

      {creating && (
        <form onSubmit={createUser} className="mt-4 rounded-xl border border-line bg-paper p-4 grid gap-3 sm:grid-cols-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoCapitalize="none"
            className="rounded-lg border border-line bg-white px-3 py-2 text-ink outline-none focus:border-accent"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (for invite & resets)"
            type="email"
            className="rounded-lg border border-line bg-white px-3 py-2 text-ink outline-none focus:border-accent"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (optional)"
            className="rounded-lg border border-line bg-white px-3 py-2 text-ink outline-none focus:border-accent"
          />
          <div className="sm:col-span-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Working…" : password ? "Create user" : "Send invite"}
            </button>
            <span className="text-xs text-muted">
              Leave the password blank to email an invite so they set their own.
            </span>
          </div>
        </form>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {notice && (
        <p className="mt-4 rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink">
          {notice}
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-muted">
              <th className="py-2 pr-3 font-medium">User</th>
              <th className="py-2 px-3 font-medium">Files</th>
              <th className="py-2 px-3 font-medium">Links (30d)</th>
              <th className="py-2 px-3 font-medium">Views</th>
              <th className="py-2 px-3 font-medium">Last login</th>
              <th className="py-2 pl-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u) => (
              <tr key={u.id} className="border-b border-line/60">
                <td className="py-3 pr-3">
                  <div className="font-medium text-ink flex items-center gap-2">
                    {u.username}
                    {u.role === "super" && (
                      <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent">
                        super
                      </span>
                    )}
                  </div>
                  {u.email && <div className="text-xs text-muted">{u.email}</div>}
                </td>
                <td className="py-3 px-3 text-ink">{u.files}</td>
                <td className="py-3 px-3 text-ink">{u.links_30d}</td>
                <td className="py-3 px-3 text-ink">{u.views}</td>
                <td className="py-3 px-3 text-muted">
                  {u.last_login_at ? timeAgo(u.last_login_at) : "Never"}
                </td>
                <td className="py-3 pl-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => resetPassword(u.id, u.username)}
                    className="text-muted hover:text-ink transition"
                  >
                    Reset password
                  </button>
                  {u.role !== "super" && u.id !== currentUserId && (
                    <button
                      onClick={() => deleteUser(u.id, u.username)}
                      className="ml-4 text-red-600 hover:text-red-700 transition"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
