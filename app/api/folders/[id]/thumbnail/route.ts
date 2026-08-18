import crypto from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../../prisma/client";
import {
  processImageUpload,
  VIDEO_PLACEHOLDER_PATH,
} from "../../../../lib/imageProcessing";
import { authOptions } from "../../../auth/[...nextauth]/route";

/**
 * Uploads a new file (image or video) and sets it as the folder thumbnail.
 *
 * The uploaded file is stored inside the folder's image repo (as a regular
 * File with variants) and linked via `Folder.folderThumbnailId`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Verify folder exists
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const fileName = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;

    if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
      return NextResponse.json(
        { error: "Invalid file type. Only images and videos allowed." },
        { status: 400 },
      );
    }

    // Deduplicate by content hash
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const existingFile = await prisma.file.findFirst({ where: { hash } });
    if (existingFile) {
      // Same file already lives in this folder → just link it as the thumbnail.
      if (existingFile.folderId === id) {
        await prisma.folder.update({
          where: { id },
          data: { folderThumbnailId: existingFile.id },
        });
        return NextResponse.json(
          {
            id: existingFile.id,
            message: "Folder thumbnail updated with existing file",
          },
          { status: 200 },
        );
      }
      return NextResponse.json(
        {
          error: "This file already exists in another folder",
          id: existingFile.id,
        },
        { status: 409 },
      );
    }

    const baseDir = join(process.cwd(), "image_repo", "images", id);
    const fileType = mimeType.startsWith("video/") ? "video" : "image";

    if (fileType === "video") {
      // Videos keep the original file plus a placeholder thumbnail (same
      // convention as the ingest pipeline — no frame extraction here).
      const originalDir = join(baseDir, "original");
      await mkdir(originalDir, { recursive: true });
      const originalPath = join(originalDir, fileName);
      await writeFile(originalPath, buffer);
      const originalStats = await stat(originalPath);

      const newFile = await prisma.file.create({
        data: {
          fileName,
          hash,
          fileSize: BigInt(buffer.length),
          fileType,
          folderId: id,
          variants: {
            create: [
              {
                name: "original",
                path: `/images/${id}/original/${fileName}`,
                size: BigInt(originalStats.size),
              },
              {
                name: "thumbnail",
                path: VIDEO_PLACEHOLDER_PATH,
                size: BigInt(0),
              },
            ],
          },
        },
        include: { variants: true },
      });

      await prisma.folder.update({
        where: { id },
        data: { folderThumbnailId: newFile.id },
      });

      return NextResponse.json(serializeFile(newFile), { status: 201 });
    }

    // Image: generate original + webp + thumbnail variants via the shared pipeline.
    const processed = await processImageUpload({
      buffer,
      originalFileName: fileName,
      baseDir,
      dbFolder: id,
      embedOrientationMeta: true,
    });

    const newFile = await prisma.file.create({
      data: {
        fileName,
        hash,
        width: processed.width,
        height: processed.height,
        fileSize: BigInt(buffer.length),
        fileType: "image",
        folderId: id,
        variants: {
          create: [
            {
              name: "original",
              path: processed.original.dbPath,
              size: BigInt(processed.original.size),
            },
            {
              name: "webp",
              path: processed.webp.dbPath,
              size: BigInt(processed.webp.size),
            },
            {
              name: "thumbnail",
              path: processed.thumbnail.dbPath,
              size: BigInt(processed.thumbnail.size),
            },
          ],
        },
      },
      include: { variants: true },
    });

    await prisma.folder.update({
      where: { id },
      data: { folderThumbnailId: newFile.id },
    });

    return NextResponse.json(serializeFile(newFile), { status: 201 });
  } catch (error) {
    console.error("Error uploading folder thumbnail:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

type FileWithVariants = {
  id: string;
  fileName: string;
  hash: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: bigint;
  fileType: "image" | "video";
  isLive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  folderId: string;
  variants: {
    id: string;
    name: string;
    width: number | null;
    height: number | null;
    size: bigint;
    path: string;
    codec: string | null;
    createdAt: Date;
    fileId: string;
  }[];
};

/** BigInt fields are not JSON-serializable — convert them to strings. */
function serializeFile(file: FileWithVariants) {
  return {
    ...file,
    fileSize: file.fileSize.toString(),
    variants: file.variants.map((variant) => ({
      ...variant,
      size: variant.size.toString(),
    })),
  };
}
