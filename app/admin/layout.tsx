import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="font-semibold tracking-tight text-ink">
            Hyde<span className="text-accent">.</span>
            <span className="ml-2 text-sm font-normal text-muted">Flip Books</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/admin/activity" className="text-sm text-muted hover:text-ink transition">
              Activity
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
