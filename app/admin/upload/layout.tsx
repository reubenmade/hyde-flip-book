import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Superusers manage accounts and don't create books — keep them out of upload.
export default async function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role === "super") redirect("/admin/users");
  return children;
}
