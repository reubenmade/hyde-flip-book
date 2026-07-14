import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "flypp_session";
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me"
);

export type Session = {
  uid: string;
  username: string;
  role: "user" | "super";
};

/** Create a signed session token identifying a specific user. */
export async function createSessionToken(user: Session): Promise<string> {
  return new SignJWT({ uid: user.uid, username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

async function verify(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.uid !== "string") return null;
    return {
      uid: payload.uid,
      username: (payload.username as string) ?? "",
      role: payload.role === "super" ? "super" : "user",
    };
  } catch {
    return null;
  }
}

/** Server-component / route-handler helper: the current request's session, if any. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verify(store.get(COOKIE_NAME)?.value);
}

/** Returns the session or throws — for route handlers behind the auth proxy. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/** Returns the session only if the user is a superuser, else throws. */
export async function requireSuper(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "super") throw new ForbiddenError();
  return session;
}

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export { COOKIE_NAME };
