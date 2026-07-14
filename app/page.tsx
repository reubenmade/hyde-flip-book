import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <div className="text-3xl font-semibold tracking-tight text-ink">
          Flypp<span className="text-accent">Book</span>
        </div>
        <p className="mt-3 text-muted">
          Beautiful, trackable flip books for clients.
        </p>
        <Link
          href="/admin"
          className="mt-8 inline-flex items-center rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
        >
          Open admin
        </Link>
      </div>
    </main>
  );
}
