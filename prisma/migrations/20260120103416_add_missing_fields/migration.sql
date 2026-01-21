-- DropIndex
DROP INDEX "Folder_name_key";

-- AlterTable
ALTER TABLE "File" ADD COLUMN "mimeType" TEXT;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN "deletedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Variant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "size" BIGINT NOT NULL,
    "path" TEXT NOT NULL,
    "codec" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileId" TEXT NOT NULL,
    CONSTRAINT "Variant_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Variant" ("codec", "fileId", "height", "id", "name", "path", "size", "width") SELECT "codec", "fileId", "height", "id", "name", "path", "size", "width" FROM "Variant";
DROP TABLE "Variant";
ALTER TABLE "new_Variant" RENAME TO "Variant";
CREATE INDEX "Variant_fileId_idx" ON "Variant"("fileId");
CREATE UNIQUE INDEX "Variant_fileId_name_key" ON "Variant"("fileId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "File_folderId_idx" ON "File"("folderId");

-- CreateIndex
CREATE INDEX "File_fileType_idx" ON "File"("fileType");

-- CreateIndex
CREATE INDEX "File_createdAt_idx" ON "File"("createdAt");

-- CreateIndex
CREATE INDEX "Folder_createdAt_idx" ON "Folder"("createdAt");

-- CreateIndex
CREATE INDEX "Folder_visible_idx" ON "Folder"("visible");
