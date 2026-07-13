"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { renderPdfToImages, buildShareImage } from "@/lib/pdf-render";

// Upload one blob to our storage endpoint; returns the stored absolute URL.
async function putBlob(pathname: string, blob: Blob, contentType: string): Promise<string> {
  const res = await fetch(`/api/blob/put?pathname=${encodeURIComponent(pathname)}`, {
    method: "POST",
    headers: { "content-type": contentType },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed for ${pathname}`);
  const { url } = await res.json();
  return url;
}

type Phase = "idle" | "rendering" | "uploading" | "finalizing" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = phase === "rendering" || phase === "uploading" || phase === "finalizing";

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    setError("");
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) {
      setError("Title and a PDF are required.");
      return;
    }
    setError("");

    try {
      // 1. Create the draft book to get an id + slug.
      const createRes = await fetch("/api/books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!createRes.ok) throw new Error("Could not create book record.");
      const { book } = await createRes.json();
      const bookId: string = book.id;

      // 2. Render every page to WebP in the browser.
      setPhase("rendering");
      const { pageBlobs } = await renderPdfToImages(file, (done, total) =>
        setProgress({ done, total })
      );

      // 3. Build the Gmail share image from the cover.
      const shareBlob = await buildShareImage(pageBlobs[0], {
        title: title.trim(),
      });

      // 4. Upload everything to Blob directly from the browser.
      setPhase("uploading");
      setProgress({ done: 0, total: pageBlobs.length + 2 });

      const pageUrls: string[] = [];
      let uploaded = 0;
      for (let i = 0; i < pageBlobs.length; i++) {
        const url = await putBlob(`books/${bookId}/page-${i}.webp`, pageBlobs[i], "image/webp");
        pageUrls.push(url);
        setProgress({ done: ++uploaded, total: pageBlobs.length + 2 });
      }

      const coverUrl = await putBlob(`books/${bookId}/cover.webp`, pageBlobs[0], "image/webp");
      setProgress({ done: ++uploaded, total: pageBlobs.length + 2 });

      const shareImageUrl = await putBlob(`books/${bookId}/share.png`, shareBlob, "image/png");
      setProgress({ done: ++uploaded, total: pageBlobs.length + 2 });

      // 5. Finalize: attach URLs, mark ready.
      setPhase("finalizing");
      const finRes = await fetch(`/api/books/${bookId}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pages: pageUrls,
          coverUrl,
          shareUrl: shareImageUrl,
        }),
      });
      if (!finRes.ok) throw new Error("Could not finalize book.");

      setPhase("done");
      router.push(`/admin/book/${bookId}`);
    } catch (err) {
      console.error(err);
      setError((err as Error).message || "Something went wrong.");
      setPhase("error");
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-ink">New flip book</h1>
      <p className="mt-1 text-sm text-muted">
        Upload a PDF. Pages are converted to images right here in your browser —
        the original file never leaves your machine or gets hosted.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink">
            Document name
          </label>
          <p className="text-xs text-muted mt-0.5">
            e.g. the suburb or property. You&apos;ll add recipients &amp; their
            share links on the next screen.
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            placeholder="Wigram"
            className="mt-1.5 w-full rounded-lg border border-line bg-white px-4 py-2.5 text-ink outline-none focus:border-accent disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">PDF</label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => !busy && fileInput.current?.click()}
            className="mt-1.5 cursor-pointer rounded-xl border-2 border-dashed border-line bg-white px-6 py-8 text-center transition hover:border-accent/60"
          >
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="text-ink font-medium">{file.name}</p>
            ) : (
              <p className="text-muted">
                Drag a PDF here, or <span className="text-accent">browse</span>
              </p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {busy && (
          <div className="rounded-lg bg-paper border border-line p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink font-medium">
                {phase === "rendering" && "Rendering pages…"}
                {phase === "uploading" && "Uploading…"}
                {phase === "finalizing" && "Finishing up…"}
              </span>
              <span className="text-muted">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full bg-accent transition-all"
                style={{
                  width: progress.total
                    ? `${(progress.done / progress.total) * 100}%`
                    : "10%",
                }}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !file}
          className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : "Create flip book"}
        </button>
      </form>
    </div>
  );
}
