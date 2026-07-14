import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="font-semibold tracking-tight text-ink">
            Flypp<span className="text-accent">Book</span>
          </Link>
          {session && (
            <div className="flex items-center gap-5">
              <Link href="/admin/activity" className="text-sm text-muted hover:text-ink transition">
                Activity
              </Link>
              {session.role === "super" && (
                <Link href="/admin/users" className="text-sm text-muted hover:text-ink transition">
                  Users
                </Link>
              )}
              <LogoutButton />
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
