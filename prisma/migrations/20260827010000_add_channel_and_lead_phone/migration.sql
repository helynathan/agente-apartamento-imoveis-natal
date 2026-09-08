-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'INSTAGRAM');

-- AlterTable
ALTER TABLE "Conversation" RENAME COLUMN "customerPhone" TO "customerExternalId";
ALTER TABLE "Conversation" ADD COLUMN     "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "Conversation" ADD COLUMN     "leadPhone" TEXT;

-- DropIndex
DROP INDEX "Conversation_customerPhone_key";

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_channel_customerExternalId_key" ON "Conversation"("channel", "customerExternalId");
