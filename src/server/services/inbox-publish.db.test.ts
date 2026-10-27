import { beforeEach, describe, expect, it, vi } from "vitest";
import { listPublicShares } from "@/lib/content";
import { prisma } from "@/lib/db";
import { NO_CONSENT_MSG, NOT_TESTIMONY_MSG } from "@/lib/validation/inbox";
import {
  deleteMessageAction,
  deletePrayerAction,
  publishPrayerAction,
  publishTestimonyAction,
  purgeOldInboxAction,
  setInboxRetentionAction,
  setMessageNoteAction,
  setPrayerNoteAction,
  unpublishPrayerAction,
  unpublishTestimonyAction,
} from "@/server/actions/inbox";
import { NavigationSignal, resetDb, setTestSession } from "@/test/db-setup";
import {
  makeContactMessage,
  makeEditor,
  makeOwner,
  makePrayerRequest,
} from "@/test/factories";
import { form } from "@/test/forms";
import {
  allAttemptRows,
  allMessageRows,
  allPrayerRows,
  allPublicShares,
  findPrayerRow,
  makeAttempt,
  makePublicShare,
} from "@/test/inbox-rows";
import { getPrayerRequest, previewPurge } from "./inbox";

const NAME = "Sita Rai";
const EMAIL = "sita.rai@example.org";
const BODY = "Original private body about Sita's surgery";

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const auditRows = () =>
  prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });

function publishForm(id: string, fields: Record<string, string> = {}) {
  return form({
    id,
    textEn: "Please pray for healing after an operation.",
    textNe: "",
    confirmNoPersonalInfo: "on",
    ...fields,
  });
}

async function expectRedirect(promise: Promise<unknown>, location: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(NavigationSignal);
  expect((error as NavigationSignal).location).toBe(location);
}

describe("private notes", () => {
  it("saves a note; the audit row has no note text", async () => {
    const prayer = await makePrayerRequest();
    const message = await makeContactMessage();
    setTestSession(await makeEditor());
    expect(
      await setPrayerNoteAction(
        null,
        form({ id: prayer.id, adminNote: "Called back on Monday" }),
      ),
    ).toMatchObject({ ok: true, message: "Note saved." });
    expect(
      await setMessageNoteAction(
        null,
        form({ id: message.id, adminNote: "Forwarded" }),
      ),
    ).toMatchObject({ ok: true });
    expect((await findPrayerRow(prayer.id))?.adminNote).toBe(
      "Called back on Monday",
    );
    const rows = await auditRows();
    expect(rows.map((r) => r.action)).toEqual(["prayer.note", "message.note"]);
    expect(rows[0]!.metadata).toEqual({ noteChanged: true, length: 21 });
    expect(JSON.stringify(rows)).not.toContain("Called back");

    // Clearing the note stores null.
    await setPrayerNoteAction(null, form({ id: prayer.id, adminNote: " " }));
    expect((await findPrayerRow(prayer.id))?.adminNote).toBeNull();
  });
});

describe("consent gating", () => {
  it("a prayer without consent cannot be published (no share, no audit)", async () => {
    const prayer = await makePrayerRequest({ shareConsent: false });
    setTestSession(await makeEditor());
    expect(await publishPrayerAction(null, publishForm(prayer.id))).toEqual({
      ok: false,
      code: "CONFLICT",
      formError: NO_CONSENT_MSG,
    });
    expect(await allPublicShares()).toHaveLength(0);
    expect(await auditRows()).toHaveLength(0);
  });

  it("a GENERAL message with consent=true still cannot be published", async () => {
    const message = await makeContactMessage({
      kind: "GENERAL",
      shareConsent: true,
    });
    setTestSession(await makeEditor());
    expect(await publishTestimonyAction(null, publishForm(message.id))).toEqual(
      { ok: false, code: "CONFLICT", formError: NOT_TESTIMONY_MSG },
    );
    expect(await allPublicShares()).toHaveLength(0);
    expect(await auditRows()).toHaveLength(0);
  });

  it("a TESTIMONY without consent cannot be published", async () => {
    const message = await makeContactMessage({
      kind: "TESTIMONY",
      shareConsent: false,
    });
    setTestSession(await makeEditor());
    expect(
      await publishTestimonyAction(null, publishForm(message.id)),
    ).toMatchObject({ ok: false, code: "CONFLICT", formError: NO_CONSENT_MSG });
    expect(await allPublicShares()).toHaveLength(0);
  });
});

describe("publishing", () => {
  it("rejects public text with the submitter's email, name or a phone number", async () => {
    const prayer = await makePrayerRequest({
      name: NAME,
      email: EMAIL,
      body: BODY,
      shareConsent: true,
    });
    setTestSession(await makeEditor());
    for (const textEn of [
      `Contact ${EMAIL}`,
      "Pray for sita and her family",
      "Call 98-4123-4567",
    ]) {
      const result = await publishPrayerAction(
        null,
        publishForm(prayer.id, { textEn }),
      );
      expect(result, textEn).toMatchObject({
        ok: false,
        code: "VALIDATION",
        fieldErrors: { textEn: expect.stringContaining("Remove it") },
      });
    }
    const ne = await publishPrayerAction(
      null,
      publishForm(prayer.id, { textEn: "", textNe: "फोन ९८४१२३४५६७" }),
    );
    expect(ne).toMatchObject({ fieldErrors: { textNe: expect.any(String) } });
    expect(
      await publishPrayerAction(
        null,
        publishForm(prayer.id, { confirmNoPersonalInfo: "" }),
      ),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { confirmNoPersonalInfo: expect.any(String) },
    });
    expect(await allPublicShares()).toHaveLength(0);
  });

  it("publishes only the edited text; re-publish updates; unpublish removes", async () => {
    const prayer = await makePrayerRequest({
      name: NAME,
      email: EMAIL,
      body: BODY,
      shareConsent: true,
    });
    const editor = await makeEditor();
    setTestSession(editor);

    expect(await publishPrayerAction(null, publishForm(prayer.id))).toEqual({
      ok: true,
      message: "Public version published.",
    });
    const shares = await listPublicShares("en");
    expect(shares).toHaveLength(1);
    expect(Object.keys(shares[0]!).sort()).toEqual([
      "id",
      "kind",
      "lang",
      "publishedAt",
      "text",
    ]);
    expect(shares[0]).toMatchObject({
      kind: "PRAYER",
      text: "Please pray for healing after an operation.",
      lang: "en",
    });
    const publicDump = JSON.stringify(shares);
    for (const secret of [BODY, NAME, EMAIL]) {
      expect(publicDump).not.toContain(secret);
    }
    expect((await allPublicShares())[0]!.publishedById).toBe(editor.id);

    // Re-publish with a Nepali version updates the same row.
    await publishPrayerAction(
      null,
      publishForm(prayer.id, { textNe: "शान्तिको लागि प्रार्थना" }),
    );
    expect(await allPublicShares()).toHaveLength(1);
    expect((await listPublicShares("ne"))[0]).toMatchObject({
      text: "शान्तिको लागि प्रार्थना",
      lang: "ne",
    });

    const audits = await auditRows();
    expect(audits.map((a) => a.metadata)).toEqual([
      { kind: "PRAYER", updated: false },
      { kind: "PRAYER", updated: true },
    ]);
    const auditDump = JSON.stringify(audits);
    for (const secret of [BODY, NAME, EMAIL, "healing", "शान्ति"]) {
      expect(auditDump).not.toContain(secret);
    }

    expect(
      await unpublishPrayerAction(null, form({ id: prayer.id })),
    ).toMatchObject({ ok: true });
    expect(await listPublicShares("en")).toEqual([]);
    // The private request itself is untouched.
    expect((await findPrayerRow(prayer.id))?.body).toBe(BODY);
  });

  it("publishes a consented testimony and unpublishes it", async () => {
    const message = await makeContactMessage({
      kind: "TESTIMONY",
      shareConsent: true,
      name: NAME,
      email: EMAIL,
    });
    setTestSession(await makeEditor());
    expect(
      await publishTestimonyAction(
        null,
        publishForm(message.id, { textEn: "God provided in a hard year." }),
      ),
    ).toMatchObject({ ok: true });
    expect((await listPublicShares("en"))[0]).toMatchObject({
      kind: "TESTIMONY",
      text: "God provided in a hard year.",
    });
    await unpublishTestimonyAction(null, form({ id: message.id }));
    expect(await allPublicShares()).toHaveLength(0);
  });

  it("listPublicShares never returns rows without text and is ordered newest first", async () => {
    const a = await makePrayerRequest({ shareConsent: true });
    const b = await makePrayerRequest({ shareConsent: true });
    await makePublicShare({
      kind: "PRAYER",
      textEn: "Older",
      prayerRequestId: a.id,
      publishedAt: new Date(Date.now() - 60_000),
    });
    await makePublicShare({
      kind: "PRAYER",
      textEn: "Newer",
      prayerRequestId: b.id,
    });
    expect((await listPublicShares("en")).map((s) => s.text)).toEqual([
      "Newer",
      "Older",
    ]);
  });
});

describe("delete", () => {
  it("deletes a prayer request and its public version, then redirects", async () => {
    const prayer = await makePrayerRequest({ shareConsent: true });
    await makePublicShare({
      kind: "PRAYER",
      textEn: "x",
      prayerRequestId: prayer.id,
    });
    setTestSession(await makeEditor());
    await expectRedirect(
      deletePrayerAction(null, form({ id: prayer.id })),
      "/admin/inbox/prayer?toast=deleted",
    );
    expect(await allPrayerRows()).toHaveLength(0);
    expect(await allPublicShares()).toHaveLength(0);
    const [audit] = await auditRows();
    expect(audit).toMatchObject({
      action: "prayer.delete",
      entityId: prayer.id,
      metadata: { hadPublicShare: true },
    });
  });

  it("deletes a message, then redirects", async () => {
    const message = await makeContactMessage();
    setTestSession(await makeEditor());
    await expectRedirect(
      deleteMessageAction(null, form({ id: message.id })),
      "/admin/inbox/messages?toast=deleted",
    );
    expect(await allMessageRows()).toHaveLength(0);
  });

  it("a missing id is NOT_FOUND and does not redirect", async () => {
    setTestSession(await makeEditor());
    expect(
      await deletePrayerAction(null, form({ id: "missing-id" })),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("retention and purge (OWNER only)", () => {
  const monthsAgo = (m: number) =>
    new Date(Date.now() - m * 31 * 24 * 60 * 60 * 1000);

  it("an EDITOR gets FORBIDDEN and nothing changes", async () => {
    const old = await makePrayerRequest({ createdAt: monthsAgo(30) });
    setTestSession(await makeEditor());
    expect(
      await setInboxRetentionAction(null, form({ inboxRetentionMonths: "6" })),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(
      await purgeOldInboxAction(null, form({ confirm: "purge" })),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await findPrayerRow(old.id)).not.toBeNull();
    expect(await auditRows()).toHaveLength(0);
  });

  it("the OWNER sets 1..60 months; 0 and 61 are rejected", async () => {
    setTestSession(await makeOwner());
    expect(
      await setInboxRetentionAction(null, form({ inboxRetentionMonths: "6" })),
    ).toMatchObject({ ok: true });
    for (const bad of ["0", "61"]) {
      expect(
        await setInboxRetentionAction(
          null,
          form({ inboxRetentionMonths: bad }),
        ),
      ).toMatchObject({ ok: false, code: "VALIDATION" });
    }
    const row = await prisma.siteSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(row?.inboxRetentionMonths).toBe(6);
    const [audit] = await auditRows();
    expect(audit!.metadata).toEqual({
      inboxRetentionMonths: { from: null, to: 6 },
    });
  });

  it("purges items older than the retention period, with their shares and old attempts", async () => {
    setTestSession(await makeOwner());
    await setInboxRetentionAction(null, form({ inboxRetentionMonths: "6" }));
    const oldPrayer = await makePrayerRequest({
      createdAt: monthsAgo(7),
      shareConsent: true,
    });
    const newPrayer = await makePrayerRequest({ createdAt: monthsAgo(5) });
    await makeContactMessage({ createdAt: monthsAgo(8) });
    const newMessage = await makeContactMessage();
    await makePublicShare({
      kind: "PRAYER",
      textEn: "old share",
      prayerRequestId: oldPrayer.id,
    });
    await makeAttempt(new Date(Date.now() - 25 * 60 * 60 * 1000));
    await makeAttempt(new Date());

    expect(await previewPurge()).toMatchObject({
      months: 6,
      prayer: 1,
      messages: 1,
      lastPurgeAt: null,
    });

    expect(await purgeOldInboxAction(null, form({ confirm: "purge" }))).toEqual(
      {
        ok: true,
        message: "Deleted 1 prayer request and 1 message.",
      },
    );
    expect((await allPrayerRows()).map((r) => r.id)).toEqual([newPrayer.id]);
    expect((await allMessageRows()).map((r) => r.id)).toEqual([newMessage.id]);
    expect(await allPublicShares()).toHaveLength(0);
    expect(await allAttemptRows()).toHaveLength(1);

    const audit = (await auditRows()).find((a) => a.action === "inbox.purge");
    expect(audit?.metadata).toMatchObject({
      months: 6,
      prayerDeleted: 1,
      messagesDeleted: 1,
      sharesDeleted: 1,
    });
    expect((await previewPurge()).lastPurgeAt).toEqual(audit!.createdAt);
  });

  it("purge needs the literal confirmation", async () => {
    setTestSession(await makeOwner());
    expect(
      await purgeOldInboxAction(null, form({ confirm: "yes" })),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

describe("admin reads", () => {
  it("the detail read includes the public version for prefill", async () => {
    const prayer = await makePrayerRequest({ shareConsent: true });
    await makePublicShare({
      kind: "PRAYER",
      textEn: "shared",
      prayerRequestId: prayer.id,
    });
    setTestSession(await makeEditor());
    expect((await getPrayerRequest(prayer.id))?.publicShare?.textEn).toBe(
      "shared",
    );
  });
});
