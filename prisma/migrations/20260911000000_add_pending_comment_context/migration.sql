-- CreateTable
CREATE TABLE "PendingCommentContext" (
    "id" TEXT NOT NULL,
    "commenterId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingCommentContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingCommentContext_commenterId_key" ON "PendingCommentContext"("commenterId");
