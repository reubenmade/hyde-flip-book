import { promises as fs } from "fs";
import path from "path";

// Local disk is used whenever no Vercel Blob token is present (i.e. `next dev`
// without cloud storage). In production on Vercel the token is injected and we
// use Vercel Blob. Both return an absolute URL we can store + proxy.
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

export const storageMode: "blob" | "local" = hasBlob ? "blob" : "local";

const LOCAL_DIR = path.join(process.cwd(), ".localblob");

function safeLocalPath(pathname: string): string {
  // Prevent path traversal; keep only sane segments.
  const clean = pathname.replace(/\.\./g, "").replace(/^\/+/, "");
  return path.join(LOCAL_DIR, clean);
}

export async function putObject(
  pathname: string,
  data: Buffer,
  contentType: string,
  origin: string
): Promise<string> {
  if (storageMode === "blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(pathname, data, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });
    return blob.url;
  }

  const dest = safeLocalPath(pathname);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, data);
  return `${origin}/api/blob/local/${pathname.replace(/^\/+/, "")}`;
}

export async function readLocalObject(
  relPath: string
): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const dest = safeLocalPath(relPath);
    const data = await fs.readFile(dest);
    return { data, contentType: guessContentType(dest) };
  } catch {
    return null;
  }
}

export async function deleteObjects(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  if (storageMode === "blob") {
    const { del } = await import("@vercel/blob");
    await del(urls).catch((e) => console.error("blob delete failed", e));
    return;
  }
  // Local: map each URL back to a file path and unlink.
  await Promise.all(
    urls.map(async (u) => {
      const marker = "/api/blob/local/";
      const idx = u.indexOf(marker);
      if (idx === -1) return;
      const rel = u.slice(idx + marker.length);
      await fs.unlink(safeLocalPath(rel)).catch(() => {});
    })
  );
}

function guessContentType(p: string): string {
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
