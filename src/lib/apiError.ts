/** Map Augflow `RespondError` JSON body to an end-user string. */
export function parseApiErrorBody(text: string): string {
  try {
    const j = JSON.parse(text) as { message?: string; error?: string };
    if (typeof j.message === "string" && j.message) {
      return j.message;
    }
    if (typeof j.error === "string" && j.error) {
      return j.error;
    }
  } catch {
    /* ignore */
  }
  return text.slice(0, 500) || "Request failed";
}
