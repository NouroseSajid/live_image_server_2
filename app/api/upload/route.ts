import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import prisma from "../../../prisma/client";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { fileTypeFromFile } from "file-type";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "100mb",
    },
  },
};

// Helper to convert BigInts to strings for JSON serialization
function jsonReplacer(key: string, value: any) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

async function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const folderId = request.headers.get("x-folder-id");
  const fileName = request.headers.get("x-file-name");

  if (!folderId || !fileName) {
    return new NextResponse("Missing folderId or fileName in headers", {
      status: 400,
    });
  }

  const tempFolder = path.join(process.cwd(), "tmp");
  await fs.mkdir(tempFolder, { recursive: true });
  const tempFilePath = path.join(tempFolder, fileName);
  let fileMoved = false;

  try {
    if (!request.body) {
      return new NextResponse("Missing file data", { status: 400 });
    }

    await pipeline(request.body, createWriteStream(tempFilePath));

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    const fileExtension = path.extname(fileName);
    const fileBaseName = path.basename(fileName, fileExtension);

    const permanentFolderBase = path.join(
      process.cwd(),
      "public",
      "images",
      folderId,
    );
    const originalFolder = path.join(permanentFolderBase, "original");
    const webpFolder = path.join(permanentFolderBase, "webp");
    const thumbFolder = path.join(permanentFolderBase, "thumbs");

    await fs.mkdir(originalFolder, { recursive: true });
    await fs.mkdir(webpFolder, { recursive: true });
    await fs.mkdir(thumbFolder, { recursive: true });

    const originalPath = path.join(originalFolder, fileName);
    const webpPath = path.join(webpFolder, `${fileBaseName}.webp`);
    const thumbPath = path.join(thumbFolder, `${fileBaseName}_thumb.webp`);

    const fileStats = await fs.stat(tempFilePath);
    const hash = await getFileHash(tempFilePath);

    const fileTypeResult = await fileTypeFromFile(tempFilePath);
    let fileType = "image";
    if (fileTypeResult && fileTypeResult.mime.startsWith("video")) {
      fileType = "video";
    }
    const fileTypeValue = fileType === "video" ? "video" : "image";

    let imageWidth = null;
    let imageHeight = null;
    let imageOrientation = 1; // Default to 1 (normal)
    let imageBuffer: Buffer;

    if (fileType === "image") {
      const image = sharp(tempFilePath);
      const metadata = await image.metadata();
      imageWidth = metadata.width;
      imageHeight = metadata.height;
      imageOrientation = metadata.orientation || 1; // Get EXIF orientation, default to 1

      // Do not apply rotation here; it will be handled by CSS based on stored orientation
      imageBuffer = await image.toBuffer();

      await sharp(imageBuffer).webp({ quality: 80 }).toFile(webpPath);
      await sharp(imageBuffer)
        .resize(200, 200, { fit: "inside" })
        .webp({ quality: 60 })
        .toFile(thumbPath);
    } else {
      // For non-image files, we can't generate webp/thumbnails
      // We can decide to copy the file as-is or handle it differently
      // For now, we'll just skip thumbnail/webp generation for non-images
      imageBuffer = await fs.readFile(tempFilePath); // Read the file into a buffer for later use if needed
    }

    const webpStats = await fs.stat(webpPath).catch(() => null);
    const thumbStats = await fs.stat(thumbPath).catch(() => null);

    const newFile = await prisma.file.create({
      data: {
        fileName: fileName,
        hash: hash,
        width: imageWidth,
        height: imageHeight,
        rotation: imageOrientation,
        fileSize: BigInt(fileStats.size),
        fileType: fileTypeValue,
        folderId: folderId,
        variants: {
          create: [
            {
              name: "original",
              path: originalPath,
              size: BigInt(fileStats.size),
            },
            ...(webpStats
              ? [{ name: "webp", path: webpPath, size: BigInt(webpStats.size) }]
              : []),
            ...(thumbStats
              ? [
                  {
                    name: "thumbnail",
                    path: thumbPath,
                    size: BigInt(thumbStats.size),
                  },
                ]
              : []),
          ],
        },
      },
    });

    await fs.rename(tempFilePath, originalPath);
    fileMoved = true;

    const responseBody = JSON.stringify(
      { message: "File uploaded successfully", file: newFile },
      jsonReplacer,
    );
    return new NextResponse(responseBody, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return new NextResponse(
        "File with this name already exists in the folder",
        { status: 409 },
      );
    }

    console.error("Error uploading file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  } finally {
    if (!fileMoved) {
      await fs
        .unlink(tempFilePath)
        .catch((err) =>
          console.error(`Failed to delete temp file: ${tempFilePath}`, err),
        );
    }
  }
}
