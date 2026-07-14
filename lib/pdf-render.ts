// Browser-only helpers. Imported exclusively from client components.

const TARGET_WIDTH = 1500; // rendered page width in px — sharp on retina, still light
const WEBP_QUALITY = 0.82;

export type RenderProgress = (done: number, total: number) => void;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
      type,
      quality
    );
  });
}

export type RenderedPdf = {
  pageBlobs: Blob[];
  width: number;
  height: number;
};

/** Render every page of a PDF to a WebP blob using pdf.js in the browser. */
export async function renderPdfToImages(
  file: File,
  onProgress?: RenderProgress
): Promise<RenderedPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  const pageBlobs: Blob[] = [];
  let width = 0;
  let height = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = TARGET_WIDTH / base.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    // White backing so transparent PDFs don't render black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    if (i === 1) {
      width = canvas.width;
      height = canvas.height;
    }
    pageBlobs.push(await canvasToBlob(canvas, "image/webp", WEBP_QUALITY));
    onProgress?.(i, doc.numPages);
    page.cleanup();
  }

  await loadingTask.destroy();
  return { pageBlobs, width, height };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Compose the email/share thumbnail: a book-styled cover on a warm card with a
 * "View flip book" affordance. Hosted publicly so Gmail can load it remotely.
 */
export async function buildShareImage(
  coverBlob: Blob,
  opts: { title: string }
): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Warm gradient backdrop.
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#f7f4ee");
  g.addColorStop(1, "#e9e3d7");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Load cover image.
  const cover = await blobToImage(coverBlob);
  const coverAspect = cover.width / cover.height;

  // Fit the cover into the left area as a "standing book".
  const maxH = 470;
  const bookH = maxH;
  const bookW = Math.min(360, bookH * coverAspect);
  const bookX = 90;
  const bookY = (H - bookH) / 2;

  // Drop shadow / spine for depth.
  ctx.save();
  ctx.shadowColor = "rgba(20,17,15,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 18;
  ctx.shadowOffsetY = 22;
  ctx.fillStyle = "#fff";
  roundRect(ctx, bookX, bookY, bookW, bookH, 8);
  ctx.fill();
  ctx.restore();

  // Cover image clipped to the book rect.
  ctx.save();
  roundRect(ctx, bookX, bookY, bookW, bookH, 8);
  ctx.clip();
  drawImageCover(ctx, cover, bookX, bookY, bookW, bookH);
  ctx.restore();

  // Spine highlight down the left edge.
  const spine = ctx.createLinearGradient(bookX, 0, bookX + 22, 0);
  spine.addColorStop(0, "rgba(0,0,0,0.28)");
  spine.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = spine;
  ctx.save();
  roundRect(ctx, bookX, bookY, bookW, bookH, 8);
  ctx.clip();
  ctx.fillRect(bookX, bookY, 22, bookH);
  ctx.restore();

  // Right-hand text column.
  const tx = bookX + bookW + 70;
  ctx.fillStyle = "#14110f";
  ctx.font = "700 46px ui-sans-serif, system-ui, -apple-system, Helvetica, Arial";
  wrapText(ctx, opts.title, tx, bookY + 70, 560, 54, 3);

  // "Open doc" pill.
  const pillY = bookY + bookH - 70;
  const pillW = 230;
  const pillH = 62;
  ctx.fillStyle = "#14110f";
  roundRect(ctx, tx, pillY, pillW, pillH, 31);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(tx + 34, pillY + 22);
  ctx.lineTo(tx + 34, pillY + 40);
  ctx.lineTo(tx + 50, pillY + 31);
  ctx.closePath();
  ctx.fill();
  ctx.font = "600 22px ui-sans-serif, system-ui, -apple-system, Helvetica, Arial";
  ctx.fillText("Open doc", tx + 66, pillY + 39);

  return canvasToBlob(canvas, "image/png");
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const ir = img.width / img.height;
  const r = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (let n = 0; n < words.length; n++) {
    const test = line ? line + " " + words[n] : words[n];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = words[n];
      y += lineHeight;
      if (++lines >= maxLines - 1) {
        // Truncate remaining with ellipsis.
        let rest = line;
        for (let m = n + 1; m < words.length; m++) rest += " " + words[m];
        while (ctx.measureText(rest + "…").width > maxWidth && rest.length)
          rest = rest.slice(0, -1);
        ctx.fillText(rest + "…", x, y);
        return;
      }
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}
