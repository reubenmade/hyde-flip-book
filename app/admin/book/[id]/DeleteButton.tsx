"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    router.push("/admin");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-muted hover:text-red-600 transition"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-muted">Delete “{title}”?</span>
      <button
        onClick={del}
        disabled={busy}
        className="font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Yes"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-muted hover:text-ink">
        No
      </button>
    </span>
  );
}
