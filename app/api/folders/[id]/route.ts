import { mkdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import slugify from "slugify";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const repoImagesDir = (folderId: string) =>
  join(process.cwd(), "image_repo", "images", folderId);

/** Best-effort path existence check. */
const pathExists = async (p: string) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

/**
 * Moves a folder's original files into `image_repo/trash/{folderId}/original`.
 * Only originals are kept — webp/thumbs are derived and regenerable, so they
 * are removed once the folder is deleted. Returns the trash path, or null if
 * the folder had no originals on disk.
 */
async function trashFolderOriginals(folderId: string): Promise<string | null> {
  const sourceDir = join(repoImagesDir(folderId), "original");
  if (!(await pathExists(sourceDir))) return null;

  let targetDir = join(process.cwd(), "image_repo", "trash", folderId);
  if (await pathExists(targetDir)) {
    targetDir = `${targetDir}_${Date.now()}`;
  }
  await mkdir(targetDir, { recursive: true });

  const trashPath = join(targetDir, "original");
  await rename(sourceDir, trashPath);
  return trashPath;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    const folder = await prisma.folder.findUnique({
      where: { id },
    });

    if (!folder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    return NextResponse.json(folder);
  } catch (error) {
    console.error("Error fetching folder:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    let {
      name,
      isPrivate,
      visible,
      archived,
      uniqueUrl,
      passphrase,
      inGridView,
      groupId,
      folderThumbnailId,
    } = body;

    if (!name) {
      return new NextResponse("Missing folder name", { status: 400 });
    }

    const normalizedPassphrase =
      typeof passphrase === "string" ? passphrase.trim() : "";
    if (isPrivate && !normalizedPassphrase) {
      return new NextResponse("Passphrase required for private folders", {
        status: 400,
      });
    }

    // Fetch the existing folder to compare name changes
    const existingFolder = await prisma.folder.findUnique({
      where: { id },
    });
    if (!existingFolder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    // If name changed and uniqueUrl not explicitly provided, regenerate uniqueUrl
    if (name !== existingFolder.name && !uniqueUrl) {
      const baseSlug = slugify(name, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;
      while (
        await prisma.folder.findFirst({
          where: { uniqueUrl: slug, id: { not: id } },
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      uniqueUrl = slug;
    } else if (uniqueUrl && uniqueUrl !== existingFolder.uniqueUrl) {
      // If uniqueUrl is provided and changed, ensure it's unique (excluding current folder)
      const conflictFolder = await prisma.folder.findFirst({
        where: { uniqueUrl, id: { not: id } },
      });
      if (conflictFolder) {
        return new NextResponse("Unique URL already exists", { status: 409 });
      }
    }

    const updatedFolder = await prisma.folder.update({
      where: { id },
      data: {
        name,
        isPrivate,
        visible,
        archived: archived || false,
        uniqueUrl,
        passphrase: normalizedPassphrase || null,
        inGridView,
        groupId: groupId || null,
        folderThumbnailId,
      },
    });

    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error("Error updating folder:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;

    // 1. Move originals to trash before touching the DB so a failed delete
    //    can be rolled back cleanly.
    let trashPath: string | null = null;
    try {
      trashPath = await trashFolderOriginals(id);
      if (trashPath) {
        console.log(
          `[FolderDelete] Trashed originals of ${id} -> ${trashPath}`,
        );
      }
    } catch (error) {
      console.error(
        `[FolderDelete] Failed to trash originals of ${id}:`,
        error,
      );
    }

    // 2. Delete the DB folder row (cascades to files/variants).
    try {
      await prisma.folder.delete({ where: { id } });
    } catch (error) {
      // 3. DB delete failed — restore the originals so the folder keeps working.
      if (trashPath) {
        try {
          await mkdir(repoImagesDir(id), { recursive: true });
          await rename(trashPath, join(repoImagesDir(id), "original"));
          console.log(
            `[FolderDelete] Restored originals of ${id} after DB failure`,
          );
        } catch (restoreError) {
          console.error(
            `[FolderDelete] Failed to restore originals of ${id}:`,
            restoreError,
          );
        }
      }
      throw error;
    }

    // 4. Remove the derived variants (webp/thumbs) left behind on disk.
    await rm(repoImagesDir(id), { recursive: true, force: true });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting folder:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
