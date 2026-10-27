-- CreateEnum
CREATE TYPE "FormKind" AS ENUM ('PRAYER', 'CONTACT');

-- CreateEnum
CREATE TYPE "PublicShareKind" AS ENUM ('PRAYER', 'TESTIMONY');

-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "adminNote" TEXT;

-- AlterTable
ALTER TABLE "PrayerRequest" ADD COLUMN     "adminNote" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "inboxRetentionMonths" INTEGER NOT NULL DEFAULT 12;

-- CreateTable
CREATE TABLE "PublicShare" (
    "id" TEXT NOT NULL,
    "kind" "PublicShareKind" NOT NULL,
    "textEn" TEXT,
    "textNe" TEXT,
    "prayerRequestId" TEXT,
    "contactMessageId" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmissionAttempt" (
    "id" TEXT NOT NULL,
    "form" "FormKind" NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicShare_prayerRequestId_key" ON "PublicShare"("prayerRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicShare_contactMessageId_key" ON "PublicShare"("contactMessageId");

-- CreateIndex
CREATE INDEX "PublicShare_publishedAt_idx" ON "PublicShare"("publishedAt");

-- CreateIndex
CREATE INDEX "FormSubmissionAttempt_form_ipHash_createdAt_idx" ON "FormSubmissionAttempt"("form", "ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "FormSubmissionAttempt_createdAt_idx" ON "FormSubmissionAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "PublicShare" ADD CONSTRAINT "PublicShare_prayerRequestId_fkey" FOREIGN KEY ("prayerRequestId") REFERENCES "PrayerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicShare" ADD CONSTRAINT "PublicShare_contactMessageId_fkey" FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicShare" ADD CONSTRAINT "PublicShare_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
