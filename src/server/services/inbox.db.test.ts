import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  setMessageStatusAction,
  setPrayerStatusAction,
} from "@/server/actions/inbox";
import { AuthzError } from "@/server/auth/guards";
import { resetDb, setTestSession } from "@/test/db-setup";
import {
  makeContactMessage,
  makeEditor,
  makePrayerRequest,
} from "@/test/factories";
import { form } from "@/test/forms";
import {
  countNewInbox,
  deleteContactMessage,
  deletePrayerRequest,
  getContactMessage,
  getPrayerRequest,
  listContactMessages,
  listPrayerRequests,
  previewPurge,
  publishPrayer,
  publishTestimony,
  purgeOldInbox,
  setMessageNote,
  setMessageStatus,
  setPrayerNote,
  setPrayerStatus,
  unpublishPrayer,
  unpublishTestimony,
} from "./inbox";

const fakeActor = {
  id: "nobody",
  email: "nobody@example.org",
  name: "Nobody",
  role: "OWNER" as const,
};
const share = (id: string) => ({
  id,
  textEn: "Pray for peace.",
  textNe: null,
  confirmNoPersonalInfo: true,
});

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("inbox service", () => {
  it("every function throws UNAUTHENTICATED without a session", async () => {
    const prayer = await makePrayerRequest();
    const message = await makeContactMessage();
    setTestSession(null);
    const calls: Promise<unknown>[] = [
      listPrayerRequests({ page: 1 }),
      getPrayerRequest(prayer.id),
      listContactMessages({ page: 1 }),
      getContactMessage(message.id),
      countNewInbox(),
      setPrayerStatus(prisma, { id: prayer.id, status: "PRAYED" }),
      setMessageStatus(prisma, { id: message.id, status: "READ" }),
      setPrayerNote(prisma, { id: prayer.id, adminNote: "x" }),
      setMessageNote(prisma, { id: message.id, adminNote: "x" }),
      deletePrayerRequest(prisma, { id: prayer.id }),
      deleteContactMessage(prisma, { id: message.id }),
      publishPrayer(prisma, share(prayer.id), fakeActor),
      publishTestimony(prisma, share(message.id), fakeActor),
      unpublishPrayer(prisma, { id: prayer.id }),
      unpublishTestimony(prisma, { id: message.id }),
      purgeOldInbox(prisma),
      previewPurge(),
    ];
    for (const call of calls) {
      const error = await call.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AuthzError);
      expect((error as AuthzError).code).toBe("UNAUTHENTICATED");
    }
    expect((await getPrayerRequestUnguarded(prayer.id)).status).toBe("NEW");
  });

  it("an EDITOR can list, read and count", async () => {
    await makePrayerRequest({ body: "Healing for my mother" });
    await makePrayerRequest({ status: "PRAYED" });
    const message = await makeContactMessage({ kind: "VOLUNTEER" });
    setTestSession(await makeEditor());

    const prayers = await listPrayerRequests({ page: 1 });
    expect(prayers.total).toBe(2);
    expect(
      (await listPrayerRequests({ page: 1, status: "NEW" })).items,
    ).toHaveLength(1);
    expect((await listPrayerRequests({ page: 1, q: "healing" })).total).toBe(1);
    expect(
      (await listContactMessages({ page: 1, kind: "VOLUNTEER" })).total,
    ).toBe(1);
    expect((await getContactMessage(message.id))?.subject).toBe("Hello");
    expect(await countNewInbox()).toEqual({ prayer: 1, messages: 1 });
  });

  it("status changes are audited without body, name or email", async () => {
    const prayer = await makePrayerRequest();
    const message = await makeContactMessage();
    setTestSession(await makeEditor());

    expect(
      await setPrayerStatusAction(
        null,
        form({ id: prayer.id, status: "PRAYED" }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      await setMessageStatusAction(
        null,
        form({ id: message.id, status: "ARCHIVED" }),
      ),
    ).toMatchObject({ ok: true });

    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(rows.map((r) => r.action)).toEqual([
      "prayer.status",
      "message.status",
    ]);
    expect(rows[0]!.metadata).toEqual({
      status: { from: "NEW", to: "PRAYED" },
    });
    const serialized = JSON.stringify(rows.map((r) => r.metadata));
    for (const secret of [
      prayer.body,
      message.body,
      "person@example.org",
      "Test Person",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect((await getPrayerRequest(prayer.id))?.status).toBe("PRAYED");
  });

  it("an invalid status is a validation error", async () => {
    const prayer = await makePrayerRequest();
    setTestSession(await makeEditor());
    expect(
      await setPrayerStatusAction(
        null,
        form({ id: prayer.id, status: "READ" }),
      ),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

/** Reads through the service with a temporary editor session. */
async function getPrayerRequestUnguarded(id: string) {
  setTestSession(await makeEditor());
  const row = await getPrayerRequest(id);
  setTestSession(null);
  if (!row) throw new Error("missing");
  return row;
}
