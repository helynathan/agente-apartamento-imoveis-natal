-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "crmSyncError" TEXT,
ADD COLUMN     "crmSyncedAt" TIMESTAMP(3),
ADD COLUMN     "customerName" TEXT;
