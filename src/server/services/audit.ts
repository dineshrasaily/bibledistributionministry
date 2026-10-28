import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { AUDIT_PAGE_SIZE } from "@/lib/validation/list-query";
import { paginate } from "./shared";

export type AuditListQuery = {
  page: number;
  entityType?: string;
  actorId?: string;
};

/** OWNER only: the audit page calls requireOwnerPage before this. */
export function listAuditLogs(query: AuditListQuery) {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
  };
  return paginate(
    query.page,
    AUDIT_PAGE_SIZE,
    () => prisma.auditLog.count({ where }),
    ({ skip, take }) =>
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
  );
}

/**
 * One AuditLog row for an admin route handler (upload transfer / token
 * routes). Server actions audit through runAdminAction instead. Metadata:
 * ids, types, sizes and counts only.
 */
export async function recordAdminAudit(entry: {
  actor: { id: string; email: string };
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actor.id,
      actorEmail: entry.actor.email,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
    },
  });
}

/** Distinct entity types, for the filter select. */
export async function listAuditEntityTypes(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });
  return rows.map((r) => r.entityType);
}
