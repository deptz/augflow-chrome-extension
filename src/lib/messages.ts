export type ToBackgroundMessage =
  | { type: "importIssue"; issueKey: string; source: "action" | "content" }
  | { type: "ping" };

export type FromBackgroundResponse =
  | { ok: true; message: string }
  | { ok: false; message: string };
