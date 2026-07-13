"use client";

import { useState, useRef, useEffect } from "react";
import { buildShareImage } from "@/lib/pdf-render";

type Recipient = {
  id: string;
  name: string;
  token: string;
  views?: number;
  max_depth?: number | null;
  last_seen?: string | null;
};

export function SharePanel({
  bookId,
  slug,
  origin,
  shareImageUrl,
  title,
  client,
  initialRecipients,
  pageCount,
}: {
  bookId: string;
  slug: string;
  origin: string; // e.g. https://host
  shareImageUrl: string | null;
  title: string;
  client: string;
  initialRecipients: Recipient[];
  pageCount: number;
}) {
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(shareImageUrl);
  const [regenerating, setRegenerating] = useState(false);
  const dataUriRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-fetch the share image as a self-contained data URI so the Gmail snippet
  // renders everywhere (including local dev) without depending on a remote fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/book/${slug}/share`);
        if (!res.ok) return;
        const blob = await res.blob();
        const uri = await blobToDataUri(blob);
        if (!cancelled) dataUriRef.current = uri;
      } catch {
        /* image just won't embed; text link still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function linkFor(token: string) {
    return `${origin}/v/${token}`;
  }

  function buildSnippetHtml(recipientName: string, url: string) {
    // Gmail can fetch a public https image (production) but not localhost, and it
    // strips data: URIs. So: prefer the hosted https URL; only fall back to a
    // data URI for local-dev preview where no public URL exists.
    const img =
      imageUrl && imageUrl.startsWith("https://")
        ? imageUrl
        : dataUriRef.current ?? imageUrl;
    const t = escapeHtml(title);
    const n = escapeHtml(recipientName);
    const imgBlock = img
      ? `<tr><td style="padding:0">
           <a href="${url}" target="_blank" style="text-decoration:none">
             <img src="${img}" alt="${t}" width="460" style="display:block;border:0;outline:none;border-radius:12px" />
           </a>
         </td></tr>`
      : "";
    return `<table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif">
  ${imgBlock}
  <tr><td style="padding:${img ? "14px" : "0"} 2px 0">
    <div style="font-size:13px;color:#6b6660;margin-bottom:3px">Prepared for ${n}</div>
    <div style="font-size:19px;font-weight:bold;color:#14110f;margin-bottom:12px">${t}</div>
    <a href="${url}" target="_blank" style="background-color:#14110f;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:bold;display:inline-block">&#9654;&nbsp;&nbsp;Open doc</a>
  </td></tr>
</table>`.trim();
  }

  async function copySnippet(recipientName: string, token: string) {
    const url = linkFor(token);
    const html = buildSnippetHtml(recipientName, url);
    const text = `${title}${client ? ` (${client})` : ""} — prepared for ${recipientName}\n${url}`;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(text);
    }
    setFlash(`Snippet copied for ${recipientName} — paste into Gmail`);
    setTimeout(() => setFlash(""), 2600);
  }

  async function addRecipient(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/books/${bookId}/recipients`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Could not add recipient.");
      const { recipient } = await res.json();
      setRecipients((r) => [{ ...recipient, views: 0 }, ...r]);
      setName("");
      // Immediately copy the personalized snippet.
      await copySnippet(recipient.name, recipient.token);
      inputRef.current?.focus();
    } catch (err) {
      setFlash((err as Error).message || "Something went wrong.");
      setTimeout(() => setFlash(""), 2600);
    } finally {
      setBusy(false);
    }
  }

  // Re-render the preview/email image from the cover (e.g. after the "prepared
  // for" text or button wording changed). Runs in the browser via canvas.
  async function regenerateImage() {
    setRegenerating(true);
    try {
      const coverRes = await fetch(`/api/book/${slug}/page/0`);
      if (!coverRes.ok) throw new Error("Could not load cover.");
      const coverBlob = await coverRes.blob();
      const shareBlob = await buildShareImage(coverBlob, { title });

      const putRes = await fetch(
        `/api/blob/put?pathname=${encodeURIComponent(`books/${bookId}/share-${Date.now()}.png`)}`,
        { method: "POST", headers: { "content-type": "image/png" }, body: shareBlob }
      );
      if (!putRes.ok) throw new Error("Upload failed.");
      const { url } = await putRes.json();

      await fetch(`/api/books/${bookId}/share-image`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shareUrl: url }),
      });

      dataUriRef.current = await blobToDataUri(shareBlob);
      setImageUrl(url);
      setFlash("Preview image updated");
      setTimeout(() => setFlash(""), 2000);
    } catch (err) {
      setFlash((err as Error).message || "Could not update image.");
      setTimeout(() => setFlash(""), 2600);
    } finally {
      setRegenerating(false);
    }
  }

  async function removeRecipient(id: string) {
    await fetch(`/api/books/${bookId}/recipients/${id}`, { method: "DELETE" });
    setRecipients((r) => r.filter((x) => x.id !== id));
  }

  async function copyPlainLink(token: string) {
    await navigator.clipboard.writeText(linkFor(token));
    setFlash("Link copied");
    setTimeout(() => setFlash(""), 1800);
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-semibold text-ink">Share</h2>

      {imageUrl && (
        <div className="mt-4">
          <div className="overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Email preview" className="w-full" />
          </div>
          <button
            onClick={regenerateImage}
            disabled={regenerating}
            className="mt-1.5 text-xs text-muted hover:text-ink transition disabled:opacity-50"
          >
            {regenerating ? "Updating…" : "↻ Refresh preview image"}
          </button>
        </div>
      )}

      {/* Add recipient */}
      <form onSubmit={addRecipient} className="mt-4">
        <label className="block text-sm font-medium text-ink">
          Add a recipient
        </label>
        <p className="text-xs text-muted mt-0.5">
          Type a name → their personalized Gmail snippet is copied instantly.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Smith"
            disabled={busy}
            className="flex-1 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Add &amp; copy
          </button>
        </div>
      </form>

      {flash && (
        <div className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
          {flash}
        </div>
      )}

      {/* Recipient list */}
      {recipients.length > 0 && (
        <ul className="mt-4 space-y-2">
          {recipients.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-line bg-white px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">
                    {r.name}
                  </div>
                  <div className="text-xs text-muted">
                    {r.views ? (
                      <>
                        {r.views} view{r.views === 1 ? "" : "s"}
                        {r.max_depth ? ` · reached pg ${r.max_depth}/${pageCount}` : ""}
                      </>
                    ) : (
                      "Not opened yet"
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeRecipient(r.id)}
                  aria-label={`Remove ${r.name}`}
                  className="shrink-0 text-muted hover:text-red-600 text-lg leading-none"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => copySnippet(r.name, r.token)}
                  className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                >
                  Copy Gmail snippet
                </button>
                <button
                  onClick={() => copyPlainLink(r.token)}
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent"
                >
                  Copy link
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted leading-relaxed">
        Paste directly into the Gmail composer — it becomes a clickable book
        thumbnail + button. (Email apps can&apos;t run the live flip animation, so
        the image links out to the full experience.)
      </p>
    </div>
  );
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
