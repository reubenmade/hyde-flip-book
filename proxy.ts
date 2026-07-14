import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "flypp_session";
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me"
);

async function authed(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.uid === "string";
  } catch {
    return false;
  }
}

// Admin pages that must stay reachable without a session.
const PUBLIC_ADMIN = ["/admin/login", "/admin/forgot"];
function isPublicAdmin(pathname: string): boolean {
  return (
    PUBLIC_ADMIN.includes(pathname) || pathname.startsWith("/admin/reset")
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect the admin UI and the admin-only API surface.
  const isProtected =
    (pathname.startsWith("/admin") && !isPublicAdmin(pathname)) ||
    pathname.startsWith("/api/books") ||
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/blob/put");

  if (!isProtected) return NextResponse.next();

  if (await authed(req)) return NextResponse.next();

  // API routes get a 401; UI routes redirect to login.
  if (pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/books/:path*",
    "/api/users/:path*",
    "/api/blob/put",
  ],
};
