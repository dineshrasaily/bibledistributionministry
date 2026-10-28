import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { prisma } from "@/lib/db";
import { isLocalKey } from "@/lib/uploads/policy";
import { resetDb, setTestSession } from "@/test/db-setup";
import { makeEditor, makeOwner } from "@/test/factories";

const client = vi.hoisted(() => ({ handleUpload: vi.fn() }));
vi.mock("@vercel/blob/client", () => client);

import { GET as libraryGET } from "@/app/api/admin/media/library/route";
import {
  GET as serveGET,
  HEAD as serveHEAD,
} from "@/app/api/uploads/[...key]/route";
import { POST as blobPOST } from "./blob/route";
import { POST as localPOST } from "./local/route";

const ORIGIN = "http://localhost";
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4,
]);
const HTML = new TextEncoder().encode(
  "<!doctype html><script>alert(1)</script>",
);

let root: string;
const files = (): string[] => {
  if (!existsSync(root)) return [];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
  return walk(root);
};

function localRequest(
  body: Uint8Array,
  {
    kind = "IMAGE",
    name = "photo.png",
    type = "image/png",
    origin = ORIGIN as string | null,
    length = String(body.length) as string | null,
  } = {},
) {
  const headers = new Headers({
    "content-type": type,
    "x-file-name": encodeURIComponent(name),
  });
  if (origin) headers.set("origin", origin);
  if (length !== null) headers.set("content-length", length);
  return new NextRequest(`${ORIGIN}/api/admin/uploads/local?kind=${kind}`, {
    method: "POST",
    headers,
    body: body as BodyInit,
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
}

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "routes-db-"));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});
beforeEach(async () => {
  await resetDb();
  await rm(root, { recursive: true, force: true });
  vi.clearAllMocks();
  vi.stubEnv("LOCAL_UPLOAD_DIR", root);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("VERCEL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/admin/uploads/local", () => {
  it("401 without a session, and nothing is written", async () => {
    const res = await localPOST(localRequest(PNG));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHENTICATED" });
    expect(files()).toEqual([]);
  });

  it("403 for a cross-origin or Origin-less request", async () => {
    setTestSession(await makeOwner());
    expect(
      (await localPOST(localRequest(PNG, { origin: "https://evil.example" })))
        .status,
    ).toBe(403);
    expect((await localPOST(localRequest(PNG, { origin: null }))).status).toBe(
      403,
    );
    expect(files()).toEqual([]);
  });

  it("415 for SVG, 413 for an oversized declared length, 411 without a length", async () => {
    setTestSession(await makeOwner());
    const svg = await localPOST(
      localRequest(new TextEncoder().encode("<svg/>"), {
        name: "x.svg",
        type: "image/svg+xml",
      }),
    );
    expect(svg.status).toBe(415);
    const big = await localPOST(
      localRequest(PNG, { length: String(8 * 1024 * 1024 + 1) }),
    );
    expect(big.status).toBe(413);
    expect((await localPOST(localRequest(PNG, { length: null }))).status).toBe(
      411,
    );
    expect(files()).toEqual([]);
  });

  it("413 when the body is longer than its declared length, and no file is left", async () => {
    setTestSession(await makeOwner());
    const res = await localPOST(localRequest(PNG, { length: "8" }));
    expect(res.status).toBe(413);
    expect(files()).toEqual([]);
  });

  it("415 for HTML bytes named .png, and the file is removed", async () => {
    setTestSession(await makeOwner());
    const res = await localPOST(localRequest(HTML));
    expect(res.status).toBe(415);
    expect(files()).toEqual([]);
  });

  it("201 for a valid PNG (owner and editor), audited without the file name", async () => {
    for (const user of [await makeOwner(), await makeEditor()]) {
      setTestSession(user);
      const res = await localPOST(
        localRequest(PNG, { name: "Family photo.png" }),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        key: string;
        url: string;
        size: number;
      };
      expect(isLocalKey(body.key)).toBe(true);
      expect(body.url).toBe(`/api/uploads/${body.key}`);
      expect(body.size).toBe(PNG.length);
      expect(existsSync(path.join(root, ...body.key.split("/")))).toBe(true);
    }
    const audits = await prisma.auditLog.findMany({
      where: { action: "media.file.store" },
    });
    expect(audits).toHaveLength(2);
    expect(JSON.stringify(audits.map((a) => a.metadata))).not.toMatch(
      /Family|family/,
    );
  });

  it("401 for a deactivated user or a revoked session", async () => {
    const owner = await makeOwner();
    setTestSession(owner);
    await prisma.adminUser.update({
      where: { id: owner.id },
      data: { sessionVersion: { increment: 1 } },
    });
    expect((await localPOST(localRequest(PNG))).status).toBe(401);
    const editor = await makeEditor();
    setTestSession(editor);
    await prisma.adminUser.update({
      where: { id: editor.id },
      data: { isActive: false },
    });
    expect((await localPOST(localRequest(PNG))).status).toBe(401);
  });

  it("503 when uploads are disabled", async () => {
    vi.stubEnv("VERCEL", "1");
    setTestSession(await makeOwner());
    expect((await localPOST(localRequest(PNG))).status).toBe(503);
  });
});

describe("POST /api/admin/uploads/blob (token route)", () => {
  const tokenBody = (
    pathname = "media/images/photo.png",
    payload = '{"kind":"IMAGE"}',
  ) =>
    JSON.stringify({
      type: "blob.generate-client-token",
      payload: { pathname, clientPayload: payload, multipart: false },
    });
  const tokenRequest = (body: string, origin: string | null = ORIGIN) =>
    new NextRequest(`${ORIGIN}/api/admin/uploads/blob`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(origin ? { origin } : {}),
      },
      body,
    });

  it("404 when Blob is not configured", async () => {
    setTestSession(await makeOwner());
    expect((await blobPOST(tokenRequest(tokenBody()))).status).toBe(404);
    expect(client.handleUpload).not.toHaveBeenCalled();
  });

  describe("with a token", () => {
    beforeEach(() => {
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
      client.handleUpload.mockResolvedValue({
        type: "blob.generate-client-token",
        clientToken: "ct",
      });
    });

    it("401 without a session and 403 cross-origin; handleUpload is not called", async () => {
      expect((await blobPOST(tokenRequest(tokenBody()))).status).toBe(401);
      setTestSession(await makeOwner());
      expect(
        (await blobPOST(tokenRequest(tokenBody(), "https://evil.example")))
          .status,
      ).toBe(403);
      expect(client.handleUpload).not.toHaveBeenCalled();
    });

    it("400 for upload-completed callbacks and invalid JSON", async () => {
      setTestSession(await makeOwner());
      const callback = JSON.stringify({
        type: "blob.upload-completed",
        payload: {},
      });
      expect((await blobPOST(tokenRequest(callback))).status).toBe(400);
      expect((await blobPOST(tokenRequest("{nope"))).status).toBe(400);
      expect(client.handleUpload).not.toHaveBeenCalled();
    });

    it("issues tokens limited by kind and audits them", async () => {
      setTestSession(await makeOwner());
      const res = await blobPOST(tokenRequest(tokenBody()));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        type: "blob.generate-client-token",
        clientToken: "ct",
      });
      const { onBeforeGenerateToken, token } =
        client.handleUpload.mock.calls[0]![0];
      expect(token).toBe("test-token");
      const image = await onBeforeGenerateToken(
        "media/images/photo.png",
        '{"kind":"IMAGE"}',
        false,
      );
      expect(image).toMatchObject({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        maximumSizeInBytes: 8 * 1024 * 1024,
        addRandomSuffix: true,
        allowOverwrite: false,
      });
      const audio = await onBeforeGenerateToken(
        "media/audio/talk.m4a",
        '{"kind":"AUDIO"}',
        true,
      );
      expect(audio).toMatchObject({
        allowedContentTypes: ["audio/mpeg", "audio/mp4", "audio/x-m4a"],
        maximumSizeInBytes: 100 * 1024 * 1024,
      });
      expect(
        await prisma.auditLog.count({
          where: { action: "media.upload.token" },
        }),
      ).toBe(2);
      await expect(
        onBeforeGenerateToken("media/images/x.mp3", '{"kind":"IMAGE"}', false),
      ).rejects.toThrow();
      await expect(
        onBeforeGenerateToken("../x.png", '{"kind":"IMAGE"}', false),
      ).rejects.toThrow();
      await expect(
        onBeforeGenerateToken("media/images/x.png", '{"kind":"VIDEO"}', false),
      ).rejects.toThrow();
      await expect(
        onBeforeGenerateToken("media/images/x.png", "not json", false),
      ).rejects.toThrow();
    });
  });
});

describe("GET /api/admin/media/library", () => {
  const libraryRequest = (query = "") =>
    new NextRequest(`${ORIGIN}/api/admin/media/library${query}`);

  it("401 without a session", async () => {
    const res = await libraryGET(libraryRequest());
    expect(res.status).toBe(401);
  });

  it("lists pictures (drafts included) or audio, never videos, with no-store", async () => {
    await prisma.mediaItem.createMany({
      data: [
        {
          id: "img-1",
          type: "IMAGE",
          titleEn: "Village",
          url: "/a.png",
          altTextEn: "Alt",
          status: "DRAFT",
        },
        {
          id: "img-2",
          type: "IMAGE",
          titleEn: "Unsafe",
          url: "javascript:alert(1)",
          altTextEn: "Alt",
        },
        { id: "aud-1", type: "AUDIO", titleEn: "Talk", url: "/t.mp3" },
        {
          id: "vid-1",
          type: "VIDEO_EMBED",
          titleEn: "Video",
          embedUrl: "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa",
        },
      ],
    });
    setTestSession(await makeEditor());
    const res = await libraryGET(libraryRequest("?kind=image&q=vill"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as {
      items: { id: string; status: string }[];
    };
    expect(body.items.map((i) => i.id)).toEqual(["img-1"]);
    expect(body.items[0]!.status).toBe("DRAFT");
    const audio = (await (
      await libraryGET(libraryRequest("?kind=audio"))
    ).json()) as { items: { id: string }[] };
    expect(audio.items.map((i) => i.id)).toEqual(["aud-1"]);
  });
});

describe("GET /api/uploads/[...key]", () => {
  const ctx = (key: string[]) => ({ params: Promise.resolve({ key }) });
  async function storedKey() {
    setTestSession(await makeOwner());
    const res = await localPOST(localRequest(PNG));
    return ((await res.json()) as { key: string }).key;
  }

  it("serves a stored file with safe headers and supports ranges", async () => {
    const key = await storedKey();
    const segments = key.split("/");
    const res = await serveGET(
      new Request(`${ORIGIN}/api/uploads/${key}`),
      ctx(segments),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);

    const partial = await serveGET(
      new Request(`${ORIGIN}/api/uploads/${key}`, {
        headers: { range: "bytes=0-9" },
      }),
      ctx(segments),
    );
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe(
      `bytes 0-9/${PNG.length}`,
    );
    expect((await partial.arrayBuffer()).byteLength).toBe(10);

    const bad = await serveGET(
      new Request(`${ORIGIN}/api/uploads/${key}`, {
        headers: { range: "bytes=99-100" },
      }),
      ctx(segments),
    );
    expect(bad.status).toBe(416);
    const head = await serveHEAD(
      new Request(`${ORIGIN}/api/uploads/${key}`, { method: "HEAD" }),
      ctx(segments),
    );
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe(String(PNG.length));
  });

  it.each([
    [["..", "..", "package.json"]],
    [["media", "images", "..", "..", "..", "package.json"]],
    [["media", "images", "2026", "01", "nope-aaaaaaaaaa.png"]],
    [["media%2F..%2F..%2Fpackage.json"]],
  ])("404 for %j", async (segments) => {
    const res = await serveGET(
      new Request(`${ORIGIN}/api/uploads/x`),
      ctx(segments),
    );
    expect(res.status).toBe(404);
  });

  it("404 in blob mode", async () => {
    const key = await storedKey();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    const res = await serveGET(
      new Request(`${ORIGIN}/api/uploads/${key}`),
      ctx(key.split("/")),
    );
    expect(res.status).toBe(404);
  });
});
