-- Existing rows come from the deprecated site crawler and will be
-- replaced by the Vista sync's next cycle; clearing them here lets
-- `codigo` be added as a required unique column without a placeholder
-- default value.
DELETE FROM "ProductPage";

-- AlterTable
ALTER TABLE "ProductPage" ADD COLUMN     "codigo" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProductPage_codigo_key" ON "ProductPage"("codigo");
