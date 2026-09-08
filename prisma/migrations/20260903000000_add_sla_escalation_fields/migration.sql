-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "lastOutboundAt" TIMESTAMP(3),
ADD COLUMN     "slaEscalatedAt" TIMESTAMP(3);
