-- Phase 7: uploaded files on MediaItem, Gallery model replacing MediaItem.eventId.
-- Data-preserving order: add -> copy event links into galleries -> drop eventId.

-- CreateEnum
CREATE TYPE "StorageDriver" AS ENUM ('LOCAL', 'VERCEL_BLOB');

-- CreateTable
CREATE TABLE "Gallery" (
    "id" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleNe" TEXT,
    "descriptionEn" TEXT,
    "descriptionNe" TEXT,
    "eventId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Gallery_pkey" PRIMARY KEY ("id")
);

-- AlterTable (new columns first; eventId is dropped after the copy below)
ALTER TABLE "MediaItem" ADD COLUMN     "galleryId" TEXT,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storageDriver" "StorageDriver",
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "width" INTEGER;

-- Copy every existing event photo link into one published gallery per event
-- (id 'gallery-' || event id, so today's public galleries stay visible).
INSERT INTO "Gallery" ("id", "titleEn", "titleNe", "eventId", "status", "publishedAt", "isDemo", "createdAt", "updatedAt")
SELECT 'gallery-' || e."id", e."titleEn", e."titleNe", e."id", 'PUBLISHED', now(), e."isDemo", now(), now()
FROM "Event" e
WHERE EXISTS (SELECT 1 FROM "MediaItem" m WHERE m."eventId" = e."id" AND m."type" = 'IMAGE')
ON CONFLICT ("id") DO NOTHING;

UPDATE "MediaItem" SET "galleryId" = 'gallery-' || "eventId"
WHERE "eventId" IS NOT NULL AND "type" = 'IMAGE';

-- DropForeignKey
ALTER TABLE "MediaItem" DROP CONSTRAINT "MediaItem_eventId_fkey";

-- DropIndex
DROP INDEX "MediaItem_eventId_status_sortOrder_idx";

-- AlterTable
ALTER TABLE "MediaItem" DROP COLUMN "eventId";

-- CreateIndex
CREATE INDEX "Gallery_status_publishedAt_idx" ON "Gallery"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Gallery_eventId_status_idx" ON "Gallery"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MediaItem_storageKey_key" ON "MediaItem"("storageKey");

-- CreateIndex
CREATE INDEX "MediaItem_galleryId_status_sortOrder_idx" ON "MediaItem"("galleryId", "status", "sortOrder");

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;