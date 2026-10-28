-- CreateEnum
CREATE TYPE "DonationInterval" AS ENUM ('ONE_TIME', 'MONTHLY');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DonationSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED');

-- AlterEnum
ALTER TYPE "FormKind" ADD VALUE 'DONATION';

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "givingInfoEn" TEXT,
ADD COLUMN     "givingInfoNe" TEXT;

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "interval" "DonationInterval" NOT NULL,
    "status" "DonationStatus" NOT NULL DEFAULT 'PAID',
    "amountRefundedCents" INTEGER NOT NULL DEFAULT 0,
    "donorEmail" TEXT,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "stripeCheckoutSessionId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationSubscription" (
    "id" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "DonationSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "donorEmail" TEXT,
    "livemode" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "outcome" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Donation_stripeCheckoutSessionId_key" ON "Donation"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_stripeInvoiceId_key" ON "Donation"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_stripePaymentIntentId_key" ON "Donation"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Donation_paidAt_idx" ON "Donation"("paidAt");

-- CreateIndex
CREATE INDEX "Donation_status_paidAt_idx" ON "Donation"("status", "paidAt");

-- CreateIndex
CREATE INDEX "Donation_interval_paidAt_idx" ON "Donation"("interval", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "DonationSubscription_stripeSubscriptionId_key" ON "DonationSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "DonationSubscription_status_idx" ON "DonationSubscription"("status");

-- CreateIndex
CREATE INDEX "StripeEvent_processedAt_idx" ON "StripeEvent"("processedAt");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "DonationSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
