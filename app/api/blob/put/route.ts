import { NextResponse } from "next/server";
import { putObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Admin-gated (via proxy.ts) upload endpoint. The browser POSTs raw image bytes
// with ?pathname=... ; we store them (Vercel Blob in prod, local disk in dev)
// and return the resulting absolute URL.
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const pathname = searchParams.get("pathname");
  if (!pathname) {
    return NextResponse.json({ error: "pathname required" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }
  if (buf.length > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? `${proto}://${host}`;

  const url = await putObject(pathname, buf, contentType, origin);
  return NextResponse.json({ url });
}
