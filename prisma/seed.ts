/** `npm run db:seed`: create-only demo seed against DATABASE_URL. */
import { createPrismaClient } from "@/lib/prisma-factory";
import { seedDemoContent } from "./seed-lib";

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: rely on the process environment.
  }
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error("DATABASE_URL is not set. See README > Local database.");
  const prisma = createPrismaClient(url);
  try {
    const report = await seedDemoContent(prisma);
    console.log(
      `Seed complete: ${report.posts} posts, ${report.events} events, ${report.verses} verses, ${report.media} media, ${report.settings} settings.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    `Seed failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
