import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hyde — Flip Books",
  description: "Beautifully hosted flip books for Hyde clients.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
