/**
 * `npm run e2e:prepare` (run by Playwright's webServer before build/start):
 * resets and seeds the local `mission_test` database, creates the E2E admin
 * users and writes their credentials to playwright/.auth/e2e-users.json.
 * Imports only pure modules (no server-only / next).
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { readTotpKey } from "../src/server/auth/keys";
import { hashPassword } from "../src/server/auth/password";
import { seal } from "../src/server/auth/secret-box";
import { newTotpSecret } from "../src/server/auth/totp";
import { seedDemoContent } from "../prisma/seed-lib";
import { assertLocalDbUrls } from "./assert-local-db";
import {
  LOCAL_DIR,
  recreateDatabase,
  ROOT_DIR,
  runPrisma,
  start,
  urlFor,
} from "./local-db";

const E2E_STARTED_MARKER = path.join(LOCAL_DIR, "e2e-started-db");
const E2E_RUNNING_MARKER = path.join(LOCAL_DIR, "e2e-running");
const E2E_USERS_FILE = path.join(
  ROOT_DIR,
  "playwright",
  ".auth",
  "e2e-users.json",
);

type E2eUser = {
  email: string;
  password: string;
  totpSecret: string;
  name: string;
  role: "OWNER" | "EDITOR";
};

const E2E_USERS = [
  { key: "owner", name: "E2E Owner", email: "owner@e2e.test", role: "OWNER" },
  {
    key: "editor",
    name: "E2E Editor",
    email: "editor@e2e.test",
    role: "EDITOR",
  },
  {
    key: "editor2",
    name: "E2E Editor 2",
    email: "editor2@e2e.test",
    role: "EDITOR",
  },
] as const;

/**
 * Phase 3 E2E fixtures (mission_test only, behind the fence above): enough
 * articles for two pages of 9, a draft, a Markdown-safety post and one
 * YouTube embed for the click-to-load facade (requests are stubbed).
 */
async function insertPhase3Fixtures(
  prisma: ReturnType<typeof createPrismaClient>,
): Promise<void> {
  for (let n = 1; n <= 5; n++) {
    await prisma.post.create({
      data: {
        type: "ARTICLE",
        slug: `e2e-article-${n}`,
        titleEn: `E2E sample article ${n}`,
        excerptEn: "Fixture article used by the pagination test.",
        status: "PUBLISHED",
        publishedAt: new Date(Date.UTC(2025, 0, n)),
        isDemo: true,
      },
    });
  }
  await prisma.post.create({
    data: {
      type: "ARTICLE",
      slug: "e2e-draft-post",
      titleEn: "E2E draft post (never public)",
      excerptEn: "Draft fixture.",
      status: "DRAFT",
      isDemo: true,
    },
  });
  await prisma.post.create({
    data: {
      type: "ARTICLE",
      slug: "e2e-markdown-safety",
      titleEn: "E2E Markdown safety",
      excerptEn: "Fixture with unsafe Markdown.",
      bodyEn:
        'Hello <script>window.__xss=1</script> world.\n\n[bad](javascript:alert(1)) and **bold** text.\n\n<img src=x onerror="window.__xss=2">',
      status: "PUBLISHED",
      publishedAt: new Date(Date.UTC(2024, 0, 1)),
      isDemo: true,
    },
  });
  await prisma.mediaItem.create({
    data: {
      id: "e2e-video",
      type: "VIDEO_EMBED",
      category: "GENERAL",
      titleEn: "E2E fixture video",
      embedUrl: "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa",
      status: "PUBLISHED",
      publishedAt: new Date(Date.UTC(2024, 0, 1)),
      isDemo: true,
    },
  });
  console.log("e2e:prepare inserted the Phase 3 fixtures.");
}

async function main(): Promise<void> {
  // 1. Fence: only the local mission_test database.
  assertLocalDbUrls(process.env);
  const url = urlFor("mission_test");
  if (process.env.DATABASE_URL !== url) {
    throw new Error(
      "e2e:prepare requires DATABASE_URL to be the local mission_test URL.",
    );
  }

  // 1b. Fresh E2E upload folder (exactly this path; Phase 7 local driver).
  rmSync(path.join(ROOT_DIR, ".local", "uploads-e2e"), {
    recursive: true,
    force: true,
  });

  // 2. Start Postgres if needed and leave markers for the teardowns.
  const { startedNow } = await start();
  mkdirSync(LOCAL_DIR, { recursive: true });
  if (startedNow) writeFileSync(E2E_STARTED_MARKER, String(process.pid));
  writeFileSync(E2E_RUNNING_MARKER, String(process.pid));

  // 3. Fresh schema.
  await recreateDatabase("mission_test");
  runPrisma(["migrate", "deploy"], url);

  // 4. Demo content.
  const prisma = createPrismaClient(url);
  try {
    const report = await seedDemoContent(prisma);
    console.log(
      `e2e:prepare seeded mission_test: ${report.posts} posts, ${report.events} events, ${report.verses} verses, ${report.media} media.`,
    );
    await insertPhase3Fixtures(prisma);

    // 5. E2E admin users (random password + TOTP secret each).
    const key = readTotpKey();
    const users: Record<string, E2eUser> = {};
    for (const spec of E2E_USERS) {
      const password = randomBytes(18).toString("base64url"); // 24 chars
      const totpSecret = newTotpSecret();
      // Create first (the id is part of the AAD), then seal (review NIT 2).
      const created = await prisma.adminUser.create({
        data: {
          email: spec.email,
          name: spec.name,
          role: spec.role,
          passwordHash: await hashPassword(password),
          totpSecretEnc: null,
          totpEnabled: false,
        },
      });
      await prisma.adminUser.update({
        where: { id: created.id },
        data: {
          totpSecretEnc: seal(totpSecret, `totp:${created.id}`, key),
          totpEnabled: true,
        },
      });
      users[spec.key] = {
        email: spec.email,
        password,
        totpSecret,
        name: spec.name,
        role: spec.role,
      };
    }

    // 6. Credentials for the Playwright helpers (gitignored folder).
    mkdirSync(path.dirname(E2E_USERS_FILE), { recursive: true });
    writeFileSync(E2E_USERS_FILE, JSON.stringify(users, null, 2));
    console.log(
      `e2e:prepare created ${E2E_USERS.length} admin users (${E2E_USERS.map((u) => u.key).join(", ")}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
