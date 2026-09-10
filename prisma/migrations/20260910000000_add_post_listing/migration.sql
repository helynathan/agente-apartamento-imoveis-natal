-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "originMediaId" TEXT;

-- CreateTable
CREATE TABLE "PostListing" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "propertyText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostListing_mediaId_key" ON "PostListing"("mediaId");
