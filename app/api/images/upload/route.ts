import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, stat, writeFile, unlink } from "node:fs/promises";
import path, { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import sharp from "sharp";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const VIDEO_THUMB_PLACEHOLDER = "/icons/video-placeholder.svg";
const RAW_THUMB_PLACEHOLDER = "/icons/video-placeholder.svg";
const VIDEO_FALLBACK_WIDTH = 1920;
const VIDEO_FALLBACK_HEIGHT = 1080;

const RAW_EXTENSIONS = new Set([
  ".arw", ".cr2", ".cr3", ".nef", ".orf", ".raf", ".rw2", ".pef", ".dng",
]);

function isRawFile(fileName: string): boolean {
  return RAW_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let originalPath = "";

  try {
    const contentType = request.headers.get("content-type") || "";
    let fileName = "";
    let folderId = "";
    let mimeType = "";
    let fileSize = BigInt(0);
    let hash = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const fId = formData.get("folderId") as string;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      if (!fId) {
        return NextResponse.json(
          { error: "No folder ID provided" },
          { status: 400 },
        );
      }

      fileName = file.name;
      folderId = fId;
      mimeType = file.type;

      const fileBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(fileBuffer);
      fileSize = BigInt(buffer.length);
      hash = crypto.createHash("sha256").update(buffer).digest("hex");

      const permanentFolderBase = join(
        process.cwd(),
        "image_repo",
        "images",
        folderId,
      );
      const originalFolder = join(permanentFolderBase, "original");
      await mkdir(originalFolder, { recursive: true });
      originalPath = join(originalFolder, fileName);
      await writeFile(originalPath, buffer);
    } else {
      // Raw stream upload (extremely memory efficient for large files)
      const rawFileName = request.headers.get("x-file-name");
      const rawFolderId = request.headers.get("x-folder-id");
      if (!rawFileName || !rawFolderId) {
        return NextResponse.json(
          { error: "Missing x-file-name or x-folder-id headers for raw upload" },
          { status: 400 },
        );
      }

      fileName = decodeURIComponent(rawFileName);
      folderId = rawFolderId;
      mimeType = contentType;

      // Verify folder exists before writing file
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      const permanentFolderBase = join(
        process.cwd(),
        "image_repo",
        "images",
        folderId,
      );
      const originalFolder = join(permanentFolderBase, "original");
      await mkdir(originalFolder, { recursive: true });
      originalPath = join(originalFolder, fileName);

      if (!request.body) {
        return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
      }

      const writeStream = createWriteStream(originalPath);
      const hashStream = crypto.createHash("sha256");
      let bytesRead = 0;

      const reader = request.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writeStream.write(value);
        hashStream.update(value);
        bytesRead += value.length;
      }
      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", () => resolve());
        writeStream.on("error", (err) => reject(err));
      });

      fileSize = BigInt(bytesRead);
      hash = hashStream.digest("hex");
    }

    // Verify folder exists (if it was multipart, we check it here; if raw, we already checked it)
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      if (originalPath) {
        try { await unlink(originalPath); } catch {}
      }
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Check if file already exists (by hash)
    const existingFile = await prisma.file.findFirst({ where: { hash } });
    if (existingFile) {
      if (originalPath) {
        try {
          await unlink(originalPath);
        } catch {}
      }
      return NextResponse.json(
        {
          error: "This file already exists in another folder",
          id: existingFile.id,
        },
        { status: 409 },
      );
    }

    // Determine file type based on MIME type
    const raw = isRawFile(fileName);
    let fileType: "image" | "video";

    if (raw || mimeType.startsWith("image/")) {
      fileType = "image";
    } else if (mimeType.startsWith("video/")) {
      fileType = "video";
    } else {
      if (originalPath) {
        try { await unlink(originalPath); } catch {}
      }
      return NextResponse.json(
        { error: "Invalid file type. Only images, videos, and RAW files allowed." },
        { status: 400 },
      );
    }

    const permanentFolderBase = join(
      process.cwd(),
      "image_repo",
      "images",
      folderId,
    );

    if (fileType === "image" && raw) {
      // RAW file handling — save original, skip sharp processing
      const originalStats = await stat(originalPath);

      const placeholderAbsolute = join(process.cwd(), "public", RAW_THUMB_PLACEHOLDER);
      let placeholderSize = BigInt(0);
      try {
        const placeholderStats = await stat(placeholderAbsolute);
        placeholderSize = BigInt(placeholderStats.size);
      } catch (_err) {
        // placeholder missing — non-fatal
      }

      const newFile = await prisma.file.create({
        data: {
          fileName,
          hash,
          mimeType: mimeType || "application/octet-stream",
          width: null,
          height: null,
          fileSize: originalStats.size,
          fileType,
          folderId,
          variants: {
            create: [
              {
                name: "original",
                path: `/images/${folderId}/original/${fileName.replace(/\\/g, "/")}`,
                size: originalStats.size,
              },
              {
                name: "thumbnail",
                path: RAW_THUMB_PLACEHOLDER,
                size: placeholderSize,
              },
            ],
          },
        },
        include: { variants: true },
      });

      const serializedVariants = newFile.variants.map((variant) => ({
        ...variant,
        size: variant.size.toString(),
      }));

      return NextResponse.json(
        {
          ...newFile,
          fileSize: newFile.fileSize.toString(),
          variants: serializedVariants,
        },
        { status: 201 },
      );
    } else if (fileType === "image") {
      const fileExtension = path.extname(fileName);
      const fileBaseName = path.basename(fileName, fileExtension);
      const webpFolder = join(permanentFolderBase, "webp");
      const thumbFolder = join(permanentFolderBase, "thumbs");

      await Promise.all([
        mkdir(webpFolder, { recursive: true }),
        mkdir(thumbFolder, { recursive: true }),
      ]);

      const rotatedSharp = sharp(originalPath, { failOnError: false }).rotate();
      const rotatedMetadata = await rotatedSharp.metadata();

      const imageWidth = rotatedMetadata.width || null;
      const imageHeight = rotatedMetadata.height || null;
      const imageRotation = 1;

      const sharpForVariants = rotatedSharp.withMetadata({
        orientation: imageRotation,
      });

      const webpPath = path.join(webpFolder, `${fileBaseName}.webp`);
      const thumbPath = path.join(thumbFolder, `${fileBaseName}_thumb.webp`);

      await sharpForVariants
        .clone()
        .webp({ quality: 85, effort: 6 })
        .toFile(webpPath);

      await sharpForVariants
        .clone()
        .resize(300, 300, {
          fit: "cover",
          position: "center",
          withoutEnlargement: false,
        })
        .webp({ quality: 80, effort: 6 })
        .toFile(thumbPath);

      const [originalStats, webpStats, thumbStats] = await Promise.all([
        stat(originalPath),
        stat(webpPath),
        stat(thumbPath),
      ]);

      const newFile = await prisma.file.create({
        data: {
          fileName,
          hash,
          mimeType,
          width: imageWidth,
          height: imageHeight,
          fileSize: fileSize,
          fileType,
          folderId,
          variants: {
            create: [
              {
                name: "original",
                path: `/images/${folderId}/original/${fileName.replace(/\\/g, "/")}`,
                size: originalStats.size,
              },
              {
                name: "webp",
                path: `/images/${folderId}/webp/${`${fileBaseName}.webp`.replace(/\\/g, "/")}`,
                size: webpStats.size,
              },
              {
                name: "thumbnail",
                path: `/images/${folderId}/thumbs/${`${fileBaseName}_thumb.webp`.replace(/\\/g, "/")}`,
                size: thumbStats.size,
              },
            ],
          },
        },
        include: { variants: true },
      });

      const serializedVariants = newFile.variants.map((variant) => ({
        ...variant,
        size: variant.size.toString(),
      }));

      return NextResponse.json(
        {
          ...newFile,
          fileSize: newFile.fileSize.toString(),
          variants: serializedVariants,
        },
        { status: 201 },
      );
    } else {
      // Video
      const originalStats = await stat(originalPath);

      const placeholderAbsolute = join(process.cwd(), "public", VIDEO_THUMB_PLACEHOLDER);
      let placeholderSize = BigInt(0);
      try {
        const placeholderStats = await stat(placeholderAbsolute);
        placeholderSize = BigInt(placeholderStats.size);
      } catch (err) {
        console.warn(
          `[upload] Video thumbnail placeholder missing at ${placeholderAbsolute}:`,
          err,
        );
      }

      const newFile = await prisma.file.create({
        data: {
          fileName,
          hash,
          mimeType,
          width: VIDEO_FALLBACK_WIDTH,
          height: VIDEO_FALLBACK_HEIGHT,
          fileSize: fileSize,
          fileType,
          folderId,
          variants: {
            create: [
              {
                name: "original",
                path: `/images/${folderId}/original/${fileName.replace(/\\/g, "/")}`,
                size: originalStats.size,
              },
              {
                name: "thumbnail",
                path: VIDEO_THUMB_PLACEHOLDER,
                size: placeholderSize,
              },
            ],
          },
        },
        include: { variants: true },
      });

      const serializedVariants = newFile.variants.map((variant) => ({
        ...variant,
        size: variant.size.toString(),
      }));

      return NextResponse.json(
        {
          ...newFile,
          fileSize: newFile.fileSize.toString(),
          variants: serializedVariants,
        },
        { status: 201 },
      );
    }
  } catch (error) {
    console.error("Error uploading image:", error);
    if (originalPath) {
      try {
        await unlink(originalPath);
      } catch {}
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

