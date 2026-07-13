/** Human phrasing for a single tracked event in the activity stream. */
export function actionText(type: string, page: number | null): string {
  if (type === "view") return "opened it";
  if (type === "progress" && page) return `reached page ${page}`;
  return type;
}
