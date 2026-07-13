/** Coarse device classification from a user-agent string. */
export function deviceOf(ua: string | null): string {
  if (!ua) return "—";
  if (/ipad|tablet/i.test(ua)) return "Tablet";
  if (/iphone|android.*mobile|mobile/i.test(ua)) return "Mobile";
  return "Desktop";
}
