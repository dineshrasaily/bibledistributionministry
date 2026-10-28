import { expect, test } from "@playwright/test";
import { PNG_320x240 } from "./fixtures/upload-files";
import { OWNER_STATE } from "./helpers/admin";

// Read-only: nothing here stores a file or a row.

test.describe("anonymous visitors", () => {
  test("are rejected by every upload and library endpoint", async ({
    request,
    baseURL,
  }) => {
    const local = await request.post("/api/admin/uploads/local?kind=IMAGE", {
      headers: {
        Origin: baseURL!,
        "Content-Type": "image/png",
        "X-File-Name": "x.png",
      },
      data: PNG_320x240,
    });
    expect(local.status()).toBe(401);
    expect(local.headers()["cache-control"]).toContain("no-store");
    // Blob mode is off in E2E (404); its 401 path is covered by the DB tests.
    const blob = await request.post("/api/admin/uploads/blob", {
      headers: { Origin: baseURL!, "Content-Type": "application/json" },
      data: { type: "blob.generate-client-token", payload: {} },
    });
    expect(blob.status()).toBe(404);
    const library = await request.get("/api/admin/media/library?kind=image");
    expect(library.status()).toBe(401);
    expect(library.headers()["cache-control"]).toContain("no-store");
    expect(library.headers()["x-robots-tag"]).toContain("noindex");
  });

  test("are sent to the login page from the media library and galleries", async ({
    page,
  }) => {
    for (const path of ["/admin/media", "/admin/galleries"]) {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/admin/login\\?next=${encodeURIComponent(path)}`),
      );
    }
  });

  test("can't read files outside the upload folder", async ({ request }) => {
    for (const path of [
      "/api/uploads/..%2F..%2Fpackage.json",
      "/api/uploads/media/images/..%2F..%2F..%2Fpackage.json",
      "/api/uploads/media/images/2026/01/nope-aaaaaaaaaa.png",
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
      expect(await res.text()).not.toContain('"name": "mission-app"');
    }
  });
});

test.describe("signed-in admins", () => {
  test.use({ storageState: OWNER_STATE });

  test("are rejected cross-origin (CSRF) even with a valid session", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/uploads/local?kind=IMAGE", {
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "image/png",
        "X-File-Name": "x.png",
      },
      data: PNG_320x240,
    });
    expect(res.status()).toBe(403);
    const noOrigin = await request.post("/api/admin/uploads/local?kind=IMAGE", {
      headers: { "Content-Type": "image/png", "X-File-Name": "x.png" },
      data: PNG_320x240,
    });
    expect(noOrigin.status()).toBe(403);
  });

  test("can read the library as JSON", async ({ request }) => {
    const res = await request.get("/api/admin/media/library?kind=image");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items.map((i) => i.id)).toContain("media-photo-1");
  });
});
