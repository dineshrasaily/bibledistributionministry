import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { checkbox } from "@/lib/validation/common";
import { fieldErrorsOf } from "@/lib/validation/errors";
import {
  type AdminActor,
  AuthzError,
  requireAdmin,
  requireOwner,
} from "@/server/auth/guards";
import { type ActionErrorCode, DomainError } from "@/server/errors";
import type { ServiceResult, Tx } from "@/server/services/shared";

/**
 * The one wrapper every admin mutation goes through:
 * guard -> Zod -> transaction (mutation + AuditLog row) -> revalidate -> result.
 * Plain server helper: deliberately has no server-action directive, so it can never
 * become a callable endpoint itself. It never redirects.
 */

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | {
      ok: false;
      code: ActionErrorCode;
      formError?: string;
      fieldErrors?: Record<string, string>;
    };

export const AUTHZ_MESSAGES = {
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You don't have permission to do that.",
} as const;
export const VALIDATION_MSG = "Please fix the highlighted fields.";
export const NOT_FOUND_MSG = "This item no longer exists. Refresh the list.";
export const ERROR_MSG = "Something went wrong. Your changes were not saved.";
export const SLUG_TAKEN_MSG = "This URL slug is already used. Choose another.";
export const EMAIL_TAKEN_MSG = "An admin with this email already exists.";
export const FEATURED_TAKEN_MSG =
  "Another verse is already featured on this date.";
export const CATEGORY_GONE_MSG =
  "One of the selected categories no longer exists. Refresh and try again.";

export type AdminActionDef<S extends z.ZodType, T> = {
  /** e.g. "post.update"; also the AuditLog action. */
  name: string;
  role: "ADMIN" | "OWNER";
  schema: S;
  entityType: string;
  revalidate: Array<"public" | "admin">;
  successMessage: string;
  run: (
    tx: Tx,
    input: z.output<S>,
    actor: AdminActor,
  ) => Promise<ServiceResult<T>>;
};

function uniqueField(error: Prisma.PrismaClientKnownRequestError): string {
  const text = `${JSON.stringify(error.meta ?? {})} ${error.message}`;
  if (text.includes("email")) return "email";
  if (text.includes("featuredOn")) return "featuredOn";
  return "slug";
}

const UNIQUE_MESSAGES: Record<string, string> = {
  slug: SLUG_TAKEN_MSG,
  email: EMAIL_TAKEN_MSG,
  featuredOn: FEATURED_TAKEN_MSG,
};

function mapError<T>(
  error: unknown,
  def: { name: string },
  actor: AdminActor,
): ActionResult<T> {
  if (error instanceof DomainError) {
    log.info("admin.action.rejected", {
      action: def.name,
      actorId: actor.id,
      code: error.code,
    });
    return error.field
      ? {
          ok: false,
          code: error.code,
          formError: error.message,
          fieldErrors: { [error.field]: error.message },
        }
      : { ok: false, code: error.code, formError: error.message };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const field = uniqueField(error);
      const message = UNIQUE_MESSAGES[field] ?? SLUG_TAKEN_MSG;
      log.info("admin.action.conflict", { action: def.name, field });
      return {
        ok: false,
        code: "CONFLICT",
        formError: message,
        fieldErrors: { [field]: message },
      };
    }
    if (error.code === "P2025") {
      log.info("admin.action.not_found", { action: def.name });
      return { ok: false, code: "NOT_FOUND", formError: NOT_FOUND_MSG };
    }
    if (error.code === "P2003") {
      log.info("admin.action.foreign_key", { action: def.name });
      return {
        ok: false,
        code: "VALIDATION",
        formError: CATEGORY_GONE_MSG,
        fieldErrors: { categoryIds: CATEGORY_GONE_MSG },
      };
    }
  }
  const err = error as Error;
  log.error("admin.action.error", {
    action: def.name,
    actorId: actor.id,
    name: err?.name,
    message: err?.message,
  });
  return { ok: false, code: "ERROR", formError: ERROR_MSG };
}

export async function runAdminAction<S extends z.ZodType, T = undefined>(
  def: AdminActionDef<S, T>,
  raw: unknown,
): Promise<ActionResult<T>> {
  // 1. Guard (before parsing anything).
  let actor: AdminActor;
  try {
    actor = def.role === "OWNER" ? await requireOwner() : await requireAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      log.warn("admin.action.denied", { action: def.name, code: error.code });
      return {
        ok: false,
        code: error.code,
        formError: AUTHZ_MESSAGES[error.code],
      };
    }
    throw error;
  }

  // 2. Validation.
  const parsed = def.schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      formError: VALIDATION_MSG,
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  // 3. Mutation + audit row in one transaction.
  let result: ServiceResult<T>;
  try {
    result = await prisma.$transaction(async (tx) => {
      const r = await def.run(tx, parsed.data as z.output<S>, actor);
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: def.name,
          entityType: def.entityType,
          entityId: r.entityId,
          metadata: r.metadata ?? Prisma.JsonNull,
        },
      });
      return r;
    });
  } catch (error) {
    unstable_rethrow(error); // notFound() inside run: rolled back, then rethrown
    return mapError<T>(error, def, actor);
  }

  // 4. Revalidation.
  if (def.revalidate.includes("public")) revalidatePath("/[locale]", "layout");
  if (def.revalidate.includes("admin")) revalidatePath("/admin", "layout");

  // 5. Result.
  return { ok: true, message: def.successMessage, data: result.data };
}

/**
 * FormData -> plain object of strings. Keys listed in `arrays` keep every
 * value; files and Next's internal `$ACTION_*` fields are dropped.
 */
export function formDataToObject(
  formData: FormData,
  opts: { arrays?: readonly string[] } = {},
): Record<string, string | string[]> {
  const arrays = new Set(opts.arrays ?? []);
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue;
    const values = formData
      .getAll(key)
      .filter((v): v is string => typeof v === "string");
    if (arrays.has(key)) out[key] = values;
    else if (values[0] !== undefined) out[key] = values[0];
  }
  return out;
}

export { checkbox };
