-- AlterTable
ALTER TABLE "MediaItem" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "aboutImageAltEn" TEXT,
ADD COLUMN     "aboutImageAltNe" TEXT,
ADD COLUMN     "aboutImageUrl" TEXT,
ADD COLUMN     "goalsEn" TEXT,
ADD COLUMN     "goalsNe" TEXT,
ADD COLUMN     "testimonyEn" TEXT,
ADD COLUMN     "testimonyNe" TEXT;

-- CreateIndex
CREATE INDEX "MediaItem_eventId_status_sortOrder_idx" ON "MediaItem"("eventId", "status", "sortOrder");

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
