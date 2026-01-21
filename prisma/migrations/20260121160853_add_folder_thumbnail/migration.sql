/*
  Warnings:

  - You are about to drop the column `folderThumb` on the `Folder` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Folder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "uniqueUrl" TEXT NOT NULL,
    "passphrase" TEXT,
    "inGridView" BOOLEAN NOT NULL DEFAULT false,
    "folderThumbnailId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Folder_folderThumbnailId_fkey" FOREIGN KEY ("folderThumbnailId") REFERENCES "File" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Folder" ("createdAt", "deletedAt", "id", "inGridView", "isPrivate", "name", "passphrase", "uniqueUrl", "updatedAt", "visible") SELECT "createdAt", "deletedAt", "id", "inGridView", "isPrivate", "name", "passphrase", "uniqueUrl", "updatedAt", "visible" FROM "Folder";
DROP TABLE "Folder";
ALTER TABLE "new_Folder" RENAME TO "Folder";
CREATE UNIQUE INDEX "Folder_uniqueUrl_key" ON "Folder"("uniqueUrl");
CREATE UNIQUE INDEX "Folder_folderThumbnailId_key" ON "Folder"("folderThumbnailId");
CREATE INDEX "Folder_createdAt_idx" ON "Folder"("createdAt");
CREATE INDEX "Folder_visible_idx" ON "Folder"("visible");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
