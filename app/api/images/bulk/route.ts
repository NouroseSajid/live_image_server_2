import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, rename, symlink, unlink } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const imagesPrefix = "/images/";

const publicPathToAbsolute = (publicPath: string) =>
  join(process.cwd(), "public", publicPath.replace(/^\/+/, ""));

const mapVariantPath = (
  variantPath: string,
  sourceFolderId: string,
  targetFolderId: string,
) => {
  const prefix = `${imagesPrefix}${sourceFolderId}/`;
  if (!variantPath.startsWith(prefix)) return variantPath;
  return variantPath.replace(prefix, `${imagesPrefix}${targetFolderId}/`);
};

const splitName = (fileName: string) => {
  const ext = extname(fileName);
  const base = basename(fileName, ext);
  return { base, ext };
};

const generateUniqueName = (
  existingNames: Set<string>,
  originalName: string,
) => {
  const { base, ext } = splitName(originalName);
  const baseCandidate = `${base} (copy)`;
  let candidate = `${baseCandidate}${ext}`;
  let index = 2;
  while (existingNames.has(candidate)) {
    candidate = `${baseCandidate} ${index}${ext}`;
    index += 1;
  }
  existingNames.add(candidate);
  return candidate;
};

const getVariantPathForName = (
  variantName: string,
  fileType: string,
  folderId: string,
  fileName: string,
  existingPath: string,
) => {
  if (variantName === "thumbnail" && existingPath.startsWith("/icons/")) {
    return existingPath;
  }

  const { base } = splitName(fileName);
  if (variantName === "original") {
    return `${imagesPrefix}${folderId}/original/${fileName}`;
  }
  if (variantName === "webp") {
    return `${imagesPrefix}${folderId}/webp/${base}.webp`;
  }
  if (variantName === "thumbnail") {
    if (fileType === "video") return existingPath;
    return `${imagesPrefix}${folderId}/thumbs/${base}_thumb.webp`;
  }
  return existingPath;
};

const ensureParentDir = async (absolutePath: string) => {
  await mkdir(dirname(absolutePath), { recursive: true });
};

const serializeFile = (file: {
  fileSize: bigint;
  variants: { size: bigint }[];
}) => ({
  ...file,
  fileSize: file.fileSize.toString(),
  variants: file.variants.map((variant) => ({
    ...variant,
    size: variant.size.toString(),
  })),
});

async function moveVariantFiles(
  variants: { path: string; name: string }[],
  sourceFolderId: string,
  targetFolderId: string,
  fileType: string,
  fileName: string,
) {
  const updates: { oldPath: string; newPath: string }[] = [];
  for (const variant of variants) {
    const newPath = getVariantPathForName(
      variant.name,
      fileType,
      targetFolderId,
      fileName,
      mapVariantPath(variant.path, sourceFolderId, targetFolderId),
    );
    if (newPath !== variant.path) {
      updates.push({ oldPath: variant.path, newPath });
    }
  }

  for (const update of updates) {
    const srcAbs = publicPathToAbsolute(update.oldPath);
    const dstAbs = publicPathToAbsolute(update.newPath);
    if (!existsSync(srcAbs)) {
      throw new Error(`Missing source file: ${update.oldPath}`);
    }
    await ensureParentDir(dstAbs);
    await rename(srcAbs, dstAbs);
  }

  return updates;
}

async function copyVariantFilesAsSymlink(
  variants: { path: string; name: string }[],
  sourceFolderId: string,
  targetFolderId: string,
  fileType: string,
  fileName: string,
) {
  const updates: { oldPath: string; newPath: string }[] = [];
  for (const variant of variants) {
    const newPath = getVariantPathForName(
      variant.name,
      fileType,
      targetFolderId,
      fileName,
      mapVariantPath(variant.path, sourceFolderId, targetFolderId),
    );
    if (newPath !== variant.path) {
      updates.push({ oldPath: variant.path, newPath });
    }
  }

  for (const update of updates) {
    const srcAbs = publicPathToAbsolute(update.oldPath);
    const dstAbs = publicPathToAbsolute(update.newPath);
    if (!existsSync(srcAbs)) {
      throw new Error(`Missing source file: ${update.oldPath}`);
    }
    await ensureParentDir(dstAbs);
    try {
      await symlink(srcAbs, dstAbs, "file");
    } catch (err) {
      console.warn("Symlink failed, falling back to copy:", err);
      await copyFile(srcAbs, dstAbs);
    }
  }

  return updates;
}

async function deleteVariantFiles(variants: { path: string }[]) {
  for (const variant of variants) {
    if (!variant.path.startsWith(imagesPrefix)) continue;
    const absPath = publicPathToAbsolute(variant.path);
    if (existsSync(absPath)) {
      try {
        await unlink(absPath);
      } catch (err) {
        console.warn("Failed to delete variant:", variant.path, err);
      }
    }
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const action: "move" | "copy" | "delete" = body?.action;
    const fileIds: string[] = body?.fileIds || [];
    const targetFolderId: string | undefined = body?.targetFolderId || undefined;
    const conflictResolution: "rename" | "replace" | "skip" | undefined =
      body?.conflictResolution || undefined;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: "No files selected" }, { status: 400 });
    }

    if ((action === "move" || action === "copy") && !targetFolderId) {
      return NextResponse.json(
        { error: "Target folder is required" },
        { status: 400 },
      );
    }

    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      include: { variants: true },
    });

    if (files.length !== fileIds.length) {
      return NextResponse.json(
        { error: "Some files were not found" },
        { status: 404 },
      );
    }

    if (action === "delete") {
      for (const file of files) {
        await deleteVariantFiles(file.variants);
        await prisma.file.delete({ where: { id: file.id } });
      }
      return NextResponse.json({ deletedIds: fileIds });
    }

    const destination = await prisma.folder.findUnique({
      where: { id: targetFolderId! },
      select: { id: true },
    });

    if (!destination) {
      return NextResponse.json(
        { error: "Target folder not found" },
        { status: 404 },
      );
    }

    const fileNames = files.map((file) => file.fileName);
    const existingInTarget = await prisma.file.findMany({
      where: {
        folderId: targetFolderId!,
        fileName: { in: fileNames },
      },
      select: { id: true, fileName: true },
    });
    const existingMap = new Map(
      existingInTarget.map((item) => [item.fileName, item.id]),
    );

    const conflicts = files
      .filter((file) => existingMap.has(file.fileName))
      .map((file) => ({
        fileId: file.id,
        fileName: file.fileName,
        existingFileId: existingMap.get(file.fileName) || "",
      }));

    if (conflicts.length > 0 && !conflictResolution) {
      return NextResponse.json(
        {
          error: "Conflicts detected",
          conflicts,
        },
        { status: 409 },
      );
    }

    const existingNames = new Set(existingInTarget.map((item) => item.fileName));
    let filesToProcess = files;
    const renameMap = new Map<string, string>();
    const skippedIds: string[] = [];

    if (conflicts.length > 0 && conflictResolution === "skip") {
      const conflictIds = new Set(conflicts.map((c) => c.fileId));
      skippedIds.push(...conflicts.map((c) => c.fileId));
      filesToProcess = files.filter((file) => !conflictIds.has(file.id));
    }

    if (conflicts.length > 0 && conflictResolution === "rename") {
      for (const conflict of conflicts) {
        const newName = generateUniqueName(existingNames, conflict.fileName);
        renameMap.set(conflict.fileId, newName);
      }
    }

    if (conflicts.length > 0 && conflictResolution === "replace") {
      for (const conflict of conflicts) {
        const existingFile = await prisma.file.findUnique({
          where: { id: conflict.existingFileId },
          include: { variants: true },
        });
        if (existingFile) {
          await deleteVariantFiles(existingFile.variants);
          await prisma.file.delete({ where: { id: existingFile.id } });
          existingNames.delete(existingFile.fileName);
        }
      }
    }

    if (action === "move") {
      const updated: typeof files = [];
      const movedIds: string[] = [];
      for (const file of filesToProcess) {
        const newFileName = renameMap.get(file.id) || file.fileName;
        const updatedPaths = await moveVariantFiles(
          file.variants,
          file.folderId,
          targetFolderId!,
          file.fileType,
          newFileName,
        );

        await prisma.$transaction([
          prisma.file.update({
            where: { id: file.id },
            data: { folderId: targetFolderId!, fileName: newFileName },
          }),
          ...updatedPaths.map((update) =>
            prisma.variant.updateMany({
              where: { fileId: file.id, path: update.oldPath },
              data: { path: update.newPath },
            }),
          ),
        ]);

        const refreshed = await prisma.file.findUnique({
          where: { id: file.id },
          include: { variants: true },
        });
        if (refreshed) updated.push(refreshed);
        movedIds.push(file.id);
      }

      return NextResponse.json({
        moved: updated.map(serializeFile),
        movedIds,
        skippedIds,
      });
    }

    if (action === "copy") {
      const created: typeof files = [];
      for (const file of filesToProcess) {
        const newFileName = renameMap.get(file.id) || file.fileName;
        await copyVariantFilesAsSymlink(
          file.variants,
          file.folderId,
          targetFolderId!,
          file.fileType,
          newFileName,
        );

        const newHash = crypto
          .createHash("sha256")
          .update(
            `${file.hash}:${targetFolderId}:${Date.now()}:${crypto.randomUUID()}`,
          )
          .digest("hex");

        const newFile = await prisma.file.create({
          data: {
            fileName: newFileName,
            hash: newHash,
            mimeType: file.mimeType,
            width: file.width,
            height: file.height,
            duration: file.duration,
            fileSize: file.fileSize,
            fileType: file.fileType,
            folderId: targetFolderId!,
            isLive: file.isLive,
            order: 0,
            variants: {
              create: file.variants.map((variant) => ({
                name: variant.name,
                width: variant.width,
                height: variant.height,
                size: variant.size,
                path: getVariantPathForName(
                  variant.name,
                  file.fileType,
                  targetFolderId!,
                  newFileName,
                  variant.path,
                ),
              })),
            },
          },
          include: { variants: true },
        });

        created.push(newFile);
      }

      return NextResponse.json({
        copied: created.map(serializeFile),
        skippedIds,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Bulk image action error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
