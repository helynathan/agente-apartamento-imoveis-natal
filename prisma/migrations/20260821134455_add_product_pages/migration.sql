-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "ProductPage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "embedding" vector(1536),
    "lastCrawledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductPage_url_key" ON "ProductPage"("url");
