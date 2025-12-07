import crypto from "crypto";
import { fileTypeFromFile } from "file-type";
import { Prisma } from "@prisma/client";
import { createReadStream, createWriteStream } from "fs";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import path from "path";
import sharp from "sharp";
import { pipeline } from "stream/promises";
import { authOptions } from "../auth/[...nextauth]/route";

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

    // Convert web ReadableStream to Node.js stream for pipeline
    const nodeStream = require("stream").Readable.fromWeb(request.body);
    await pipeline(nodeStream, createWriteStream(tempFilePath));

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

    let imageWidth: number | null = null;
    let imageHeight: number | null = null;
    let imageOrientation = 1; // Default to 1 (normal)
    let imageBuffer: Buffer | null = null;
    let originalOrientation = 1;

    if (fileType === "image") {
      // PROPER ROTATION HANDLING - FIXED VERSION
      try {
        // First, get the original metadata to check EXIF orientation
        const originalSharp = sharp(tempFilePath, { failOnError: false });
        const meta = await originalSharp.metadata();
        originalOrientation = meta.orientation || 1;

        console.log(
          `Original orientation for ${fileName}: ${originalOrientation}`,
        );

        // Auto-rotate according to EXIF orientation, producing an upright image
        const rotatedSharp = sharp(tempFilePath, {
          failOnError: false,
        }).rotate();
        const rotatedMetadata = await rotatedSharp.metadata();

        imageWidth = rotatedMetadata.width ?? null;
        imageHeight = rotatedMetadata.height ?? null;
        imageOrientation = 1; // After rotation, orientation is normalized

        console.log(`Dimensions after rotation: ${imageWidth}x${imageHeight}`);

        // Determine if image should be landscape or portrait based on final dimensions
        if (imageWidth && imageHeight) {
          const isPortrait = imageHeight > imageWidth;
          console.log(
            `Image orientation: ${isPortrait ? "Portrait" : "Landscape"}`,
          );
        }

        // Generate variants using the rotated image
        try {
          await rotatedSharp
            .clone()
            .webp({ quality: 85, effort: 6 })
            .toFile(webpPath);
          console.log(`Generated WebP: ${webpPath}`);
        } catch (err) {
          console.warn(
            "Warning: failed to create webp variant from rotated image:",
            err,
          );
        }

        try {
          await rotatedSharp
            .clone()
            .resize(300, 300, {
              fit: "cover",
              position: "center",
              withoutEnlargement: false,
            })
            .webp({ quality: 80, effort: 6 })
            .toFile(thumbPath);
          console.log(`Generated thumbnail: ${thumbPath}`);
        } catch (err) {
          console.warn(
            "Warning: failed to create thumbnail from rotated image:",
            err,
          );
        }

        try {
          imageBuffer = await rotatedSharp.toBuffer();
        } catch (err) {
          imageBuffer = null;
        }
      } catch (err: any) {
        console.warn(
          "sharp.rotate/metadata failed, falling back to non-rotated handling:",
          err.message || err,
        );

        // Fallback: try reading metadata from the original file without rotate
        try {
          const originalSharp = sharp(tempFilePath, { failOnError: false });
          const meta = await originalSharp.metadata();
          imageWidth = meta.width ?? null;
          imageHeight = meta.height ?? null;
          originalOrientation = meta.orientation ?? 1;
          imageOrientation = originalOrientation;

          try {
            await originalSharp
              .clone()
              .webp({ quality: 85, effort: 6 })
              .toFile(webpPath);
          } catch (err) {
            console.warn(
              "Warning: failed to create webp variant from original image:",
              err,
            );
          }

          try {
            await originalSharp
              .clone()
              .resize(300, 300, {
                fit: "cover",
                position: "center",
                withoutEnlargement: false,
              })
              .webp({ quality: 80, effort: 6 })
              .toFile(thumbPath);
          } catch (err) {
            console.warn(
              "Warning: failed to create thumbnail from original image:",
              err,
            );
          }

          try {
            imageBuffer = await originalSharp.toBuffer();
          } catch (err) {
            imageBuffer = null;
          }
        } catch (err: any) {
          console.warn(
            "sharp metadata fallback also failed; skipping variant generation:",
            err.message || err,
          );
          imageBuffer = await fs.readFile(tempFilePath);
        }
      }
    } else {
      // For non-image files, we can't generate webp/thumbnails
      imageBuffer = await fs.readFile(tempFilePath);
    }

    const webpStats = await fs.stat(webpPath).catch(() => null);
    const thumbStats = await fs.stat(thumbPath).catch(() => null);

    const newFile = await prisma.file.create({
      data: {
        fileName: fileName,
        hash: hash,
        width: imageWidth,
        height: imageHeight,
        rotation: imageOrientation, // Store the normalized orientation
        originalOrientation: originalOrientation, // Store original EXIF orientation for reference
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
