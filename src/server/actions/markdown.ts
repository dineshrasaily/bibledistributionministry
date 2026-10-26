"use server";

import { z } from "zod";
import { log } from "@/lib/log";
import { renderMarkdown } from "@/lib/markdown";
import { AuthzError, requireAdmin } from "@/server/auth/guards";

export type PreviewResult =
  | { ok: true; html: string }
  | {
      ok: false;
      code: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "ERROR";
      formError: string;
    };

const markdownInput = z.string().max(50_000);

/** Read-only live preview: same sanitizer as production; no audit, no revalidation. */
export async function previewMarkdownAction(
  md: string,
): Promise<PreviewResult> {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false,
        code: e.code,
        formError: "Your session has expired. Please sign in again.",
      };
    }
    throw e;
  }
  const parsed = markdownInput.safeParse(md);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      formError: "Preview is limited to 50,000 characters.",
    };
  }
  try {
    return { ok: true, html: renderMarkdown(parsed.data) };
  } catch (e) {
    log.error("markdown.preview.error", { name: (e as Error)?.name });
    return { ok: false, code: "ERROR", formError: "Preview unavailable" };
  }
}
