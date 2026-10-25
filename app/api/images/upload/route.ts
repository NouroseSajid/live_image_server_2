import crypto from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import sharp from "sharp";
import prisma from "../../../../prisma/client";
import { getStorage, storageKey } from "../../../lib/storage";
import { authOptions } from "../../auth/[...nextauth]/route";

const VIDEO_THUMB_PLACEHOLDER = "/icons/video-placeholder.svg";
const RAW_THUMB_PLACEHOLDER = "/icons/video-placeholder.svg";
const VIDEO_FALLBACK_WIDTH = 1920;
const VIDEO_FALLBACK_HEIGHT = 1080;

const RAW_EXTENSIONS = new Set([
  ".arw",
  ".cr2",
  ".cr3",
  ".nef",
  ".orf",
  ".raf",
  ".rw2",
  ".pef",
  ".dng",
]);

function isRawFile(fileName: string): boolean {
  return RAW_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

/** Read a stored object fully into memory (only used for image variants). */
async function readStorageObject(key: string): Promise<Buffer> {
  const { stream } = await getStorage().read(key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let originalKey = "";
  let originalBuffer: Buffer | null = null;
  const storage = getStorage();

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
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 },
        );
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

      originalKey = storageKey("images", folderId, "original", fileName);
      originalBuffer = buffer;
      await storage.write(originalKey, buffer);
    } else {
      // Raw stream upload (extremely memory efficient for large files)
      const rawFileName = request.headers.get("x-file-name");
      const rawFolderId = request.headers.get("x-folder-id");
      if (!rawFileName || !rawFolderId) {
        return NextResponse.json(
          {
            error: "Missing x-file-name or x-folder-id headers for raw upload",
          },
          { status: 400 },
        );
      }

      fileName = decodeURIComponent(rawFileName);
      folderId = rawFolderId;
      mimeType = contentType;

      // Verify folder exists before writing file
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      });
      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 },
        );
      }

      originalKey = storageKey("images", folderId, "original", fileName);

      if (!request.body) {
        return NextResponse.json(
          { error: "Request body is empty" },
          { status: 400 },
        );
      }

      const hashStream = crypto.createHash("sha256");
      const hashingStream = request.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            hashStream.update(chunk);
            controller.enqueue(chunk);
          },
        }),
      );

      const { size } = await storage.writeStream(originalKey, hashingStream);

      fileSize = BigInt(size);
      hash = hashStream.digest("hex");
    }

    // Verify folder exists (if it was multipart, we check it here; if raw, we already checked it)
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      if (originalKey) {
        try {
          await storage.remove(originalKey);
        } catch {}
      }
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Check if file already exists (by hash)
    const existingFile = await prisma.file.findFirst({ where: { hash } });
    if (existingFile) {
      if (originalKey) {
        try {
          await storage.remove(originalKey);
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
      if (originalKey) {
        try {
          await storage.remove(originalKey);
        } catch {}
      }
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only images, videos, and RAW files allowed.",
        },
        { status: 400 },
      );
    }

    if (fileType === "image" && raw) {
      // RAW file handling — save original, skip sharp processing
      const placeholderAbsolute = path.join(
        process.cwd(),
        "public",
        RAW_THUMB_PLACEHOLDER,
      );
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
          fileSize,
          fileType,
          folderId,
          variants: {
            create: [
              {
                name: "original",
                path: `/images/${folderId}/original/${fileName.replace(/\\/g, "/")}`,
                size: fileSize,
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

      // Raw stream uploads don't keep the original bytes in memory; read them
      // back through the storage driver so S3-style backends work too.
      const sourceBuffer =
        originalBuffer ?? (await readStorageObject(originalKey));

      const rotatedSharp = sharp(sourceBuffer, { failOnError: false }).rotate();
      const rotatedMetadata = await rotatedSharp.metadata();

      const imageWidth = rotatedMetadata.width || null;
      const imageHeight = rotatedMetadata.height || null;
      const imageRotation = 1;

      const sharpForVariants = rotatedSharp.withMetadata({
        orientation: imageRotation,
      });

      const webpBuffer = await sharpForVariants
        .clone()
        .webp({ quality: 85, effort: 6 })
        .toBuffer();

      const thumbBuffer = await sharpForVariants
        .clone()
        .resize(300, 300, {
          fit: "cover",
          position: "center",
          withoutEnlargement: false,
        })
        .webp({ quality: 80, effort: 6 })
        .toBuffer();

      await Promise.all([
        storage.write(
          storageKey("images", folderId, "webp", `${fileBaseName}.webp`),
          webpBuffer,
        ),
        storage.write(
          storageKey(
            "images",
            folderId,
            "thumbs",
            `${fileBaseName}_thumb.webp`,
          ),
          thumbBuffer,
        ),
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
                size: fileSize,
              },
              {
                name: "webp",
                path: `/images/${folderId}/webp/${`${fileBaseName}.webp`.replace(/\\/g, "/")}`,
                size: BigInt(webpBuffer.length),
              },
              {
                name: "thumbnail",
                path: `/images/${folderId}/thumbs/${`${fileBaseName}_thumb.webp`.replace(/\\/g, "/")}`,
                size: BigInt(thumbBuffer.length),
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
      const placeholderAbsolute = path.join(
        process.cwd(),
        "public",
        VIDEO_THUMB_PLACEHOLDER,
      );
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
                size: fileSize,
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
    if (originalKey) {
      try {
        await storage.remove(originalKey);
      } catch {}
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
