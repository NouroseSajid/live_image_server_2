/*
  Warnings:

  - You are about to drop the column `rotation` on the `File` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_File" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" REAL,
    "fileSize" BIGINT NOT NULL,
    "fileType" TEXT NOT NULL,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "orientation" INTEGER DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "folderId" TEXT NOT NULL,
    CONSTRAINT "File_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_File" ("createdAt", "deletedAt", "duration", "fileName", "fileSize", "fileType", "folderId", "hash", "height", "id", "isLive", "updatedAt", "width") SELECT "createdAt", "deletedAt", "duration", "fileName", "fileSize", "fileType", "folderId", "hash", "height", "id", "isLive", "updatedAt", "width" FROM "File";
DROP TABLE "File";
ALTER TABLE "new_File" RENAME TO "File";
CREATE UNIQUE INDEX "File_hash_key" ON "File"("hash");
CREATE UNIQUE INDEX "File_folderId_fileName_key" ON "File"("folderId", "fileName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
