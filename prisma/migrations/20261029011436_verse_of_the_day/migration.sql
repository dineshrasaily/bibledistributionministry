-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "autoVerseEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoVerseTranslation" "BibleTranslation" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "siteTimezone" TEXT NOT NULL DEFAULT 'America/New_York';
