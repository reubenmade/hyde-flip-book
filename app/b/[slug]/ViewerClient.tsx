"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Props = { slug: string; title: string; pageCount: number; token: string | null };

// Persist a lightweight anonymous session id so repeat visits are grouped.
function getSessionId(): string {
  try {
    let id = localStorage.getItem("hyde_sid");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("hyde_sid", id);
    }
    return id;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

export function ViewerClient({ slug, title, pageCount, token }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<unknown>(null);
  const maxDepthRef = useRef(1);
  const sessionRef = useRef<string>("");
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState(1);
  const [total, setTotal] = useState(pageCount);

  const pageUrls = Array.from(
    { length: pageCount },
    (_, i) => `/api/book/${slug}/page/${i}`
  );

  // Fire-and-forget analytics beacon.
  const track = useCallback(
    (type: "view" | "progress", page: number) => {
      const body = JSON.stringify({
        slug,
        token: token || undefined,
        sessionId: sessionRef.current,
        type,
        page,
        maxDepth: maxDepthRef.current,
        referrer: document.referrer || undefined,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        } else {
          fetch("/api/track", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            keepalive: true,
          });
        }
      } catch {
        /* ignore */
      }
    },
    [slug, token]
  );

  useEffect(() => {
    sessionRef.current = getSessionId();
    let flip: { destroy: () => void } | null = null;
    let disposed = false;

    (async () => {
      const { PageFlip } = await import("page-flip");
      // Determine page aspect ratio from the first image.
      const aspect = await imageAspect(pageUrls[0]).catch(() => 0.75);

      if (disposed || !containerRef.current) return;

      const baseWidth = 480;
      const baseHeight = Math.round(baseWidth / aspect);

      const pf = new PageFlip(containerRef.current, {
        width: baseWidth,
        height: baseHeight,
        size: "stretch",
        minWidth: 280,
        maxWidth: 900,
        minHeight: 350,
        maxHeight: 1400,
        drawShadow: true,
        maxShadowOpacity: 0.5,
        flippingTime: 700,
        usePortrait: true,
        showCover: true,
        mobileScrollSupport: true,
        clickEventForward: true,
        useMouseEvents: true,
        autoSize: true,
      });

      // Register handlers BEFORE loading so the async `init` isn't missed.
      pf.on("init", () => {
        setReady(true);
        setTotal(pf.getPageCount());
      });

      pf.on("flip", (e: { data: number }) => {
        const page = e.data + 1; // 0-indexed -> 1-indexed
        setCurrent(page);
        if (page > maxDepthRef.current) maxDepthRef.current = page;
        track("progress", page);
      });

      pf.loadFromImages(pageUrls);
      flipRef.current = pf;
      flip = pf;

      // Initial view event.
      track("view", 1);
    })();

    return () => {
      disposed = true;
      try {
        flip?.destroy();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush deepest depth when the tab is hidden/closed.
  useEffect(() => {
    const flush = () => track("progress", current);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [track, current]);

  const prev = () =>
    (flipRef.current as { flipPrev?: () => void })?.flipPrev?.();
  const next = () =>
    (flipRef.current as { flipNext?: () => void })?.flipNext?.();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="no-lift flex min-h-screen flex-col bg-[#14110f]"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 text-white/80">
        <div className="text-sm font-medium tracking-tight">
          Hyde<span className="text-accent">.</span>
          <span className="ml-2 text-white/50 hidden sm:inline">{title}</span>
        </div>
        <div className="text-xs tabular-nums text-white/50">
          {current} / {total}
        </div>
      </div>

      {/* Book stage */}
      <div className="relative flex flex-1 items-center justify-center px-2 pb-6 sm:px-8">
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          </div>
        )}

        {/* Desktop nav arrows */}
        <button
          onClick={prev}
          aria-label="Previous page"
          className="absolute left-2 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20 sm:flex"
        >
          ‹
        </button>

        <div
          ref={containerRef}
          className="mx-auto"
          style={{ width: "100%", maxWidth: 900, touchAction: "pan-y" }}
        />

        <button
          onClick={next}
          aria-label="Next page"
          className="absolute right-2 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20 sm:flex"
        >
          ›
        </button>
      </div>

      {/* Mobile controls */}
      <div className="flex items-center justify-center gap-6 pb-6 sm:hidden">
        <button
          onClick={prev}
          className="h-11 w-11 rounded-full bg-white/10 text-white/80"
          aria-label="Previous page"
        >
          ‹
        </button>
        <span className="text-xs tabular-nums text-white/50">
          {current} / {total}
        </span>
        <button
          onClick={next}
          className="h-11 w-11 rounded-full bg-white/10 text-white/80"
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}

function imageAspect(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = reject;
    img.src = url;
  });
}
