import crypto from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path, { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import sharp from "sharp";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folderId = formData.get("folderId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!folderId) {
      return NextResponse.json(
        { error: "No folder ID provided" },
        { status: 400 },
      );
    }

    // Verify folder exists
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Get file extension and validate
    const fileName = file.name;
    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);

    // Determine file type based on MIME type
    const mimeType = file.type;
    let fileType: "image" | "video";

    if (mimeType.startsWith("image/")) {
      fileType = "image";
    } else if (mimeType.startsWith("video/")) {
      fileType = "video";
    } else {
      return NextResponse.json(
        { error: "Invalid file type. Only images and videos allowed." },
        { status: 400 },
      );
    }

    // Calculate file hash
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Check if file already exists (by hash)
    const existingFile = await prisma.file.findFirst({ where: { hash } });
    if (existingFile) {
      return NextResponse.json(
        {
          error: "This file already exists in another folder",
          id: existingFile.id,
        },
        { status: 409 },
      );
    }

    const permanentFolderBase = join(
      process.cwd(),
      "public",
      "images",
      folderId,
    );

    if (fileType === "image") {
      const fileExtension = path.extname(fileName);
      const fileBaseName = path.basename(fileName, fileExtension);
      const originalFolder = join(permanentFolderBase, "original");
      const webpFolder = join(permanentFolderBase, "webp");
      const thumbFolder = join(permanentFolderBase, "thumbs");

      await Promise.all([
        mkdir(originalFolder, { recursive: true }),
        mkdir(webpFolder, { recursive: true }),
        mkdir(thumbFolder, { recursive: true }),
      ]);

      const originalPath = join(originalFolder, fileName);
      await writeFile(originalPath, buffer);

      const rotatedSharp = sharp(buffer, { failOnError: false }).rotate();
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
          width: imageWidth,
          height: imageHeight,
          fileSize: BigInt(buffer.length),
          fileType,
          folderId,
          variants: {
            create: [
              {
                name: "original",
                path: `/images/${folderId}/original/${fileName.replace(/\\/g, "/")}`,
                size: BigInt(originalStats.size),
              },
              {
                name: "webp",
                path: `/images/${folderId}/webp/${`${fileBaseName}.webp`.replace(/\\/g, "/")}`,
                size: BigInt(webpStats.size),
              },
              {
                name: "thumbnail",
                path: `/images/${folderId}/thumbs/${`${fileBaseName}_thumb.webp`.replace(/\\/g, "/")}`,
                size: BigInt(thumbStats.size),
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
      const originalFolder = join(permanentFolderBase, "original");
      await mkdir(originalFolder, { recursive: true });
      const originalPath = join(originalFolder, fileName);
      await writeFile(originalPath, buffer);
      const originalStats = await stat(originalPath);

      const newFile = await prisma.file.create({
        data: {
          fileName,
          hash,
          fileSize: BigInt(buffer.length),
          fileType,
          folderId,
          variants: {
            create: [
              {
                name: "original",
                path: `/images/${folderId}/original/${fileName.replace(/\\/g, "/")}`,
                size: BigInt(originalStats.size),
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
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
