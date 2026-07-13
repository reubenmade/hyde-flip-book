import { readLocalObject, storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Serves locally-stored images in dev mode only. In production, storage is
// Vercel Blob and this route returns 404 (images come from proxied blob URLs).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (storageMode !== "local") {
    return new Response("Not found", { status: 404 });
  }
  const { path } = await params;
  const rel = path.join("/");
  const obj = await readLocalObject(rel);
  if (!obj) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(obj.data), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
