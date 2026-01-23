// app/api/images/download-zip/route.ts

import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import { PrismaClient } from "@prisma/client";
import archiver from "archiver";
import { type NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

const DOWNLOAD_TIMEOUT = 15 * 60 * 1000; // 15 minute timeout for large files
const MAX_BATCH_SIZE = 500; // Max number of images per request

export async function POST(req: NextRequest) {
  try {
    const { imageIds, quality = "webp" } = await req.json();

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json(
        { error: "No image IDs provided." },
        { status: 400 },
      );
    }

    // Limit to reasonable batch size
    if (imageIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Too many images selected (max ${MAX_BATCH_SIZE}).` },
        { status: 400 },
      );
    }

    const filesToZip = await prisma.file.findMany({
      where: {
        id: {
          in: imageIds,
        },
      },
      include: {
        variants: true,
      },
    });

    if (filesToZip.length === 0) {
      return NextResponse.json(
        { error: "No images found for the provided IDs." },
        { status: 404 },
      );
    }

    // Filter for files that have the requested variant quality
    const filesWithPaths = filesToZip
      .map((file) => {
        // Try to find the requested quality first
        let variant = file.variants.find((v) => v.name === quality);

        // Fallback to original if requested quality not found
        if (!variant) {
          variant = file.variants.find((v) => v.name === "original");
        }

        // Fallback to any available variant
        if (!variant && file.variants.length > 0) {
          variant = file.variants[0];
        }

        if (!variant) {
          console.warn(`No suitable variant found for file ID: ${file.id}`);
          return null;
        }

        // Construct the full path to the image file.
        const filePath = path.join(process.cwd(), "public", variant.path);
        const fileSize = Number(variant.size) || 0;
        return {
          fileName: file.fileName,
          filePath: filePath,
          size: fileSize,
        };
      })
      .filter(Boolean);

    if (filesWithPaths.length === 0) {
      return NextResponse.json(
        { error: "No image files available for download." },
        { status: 400 },
      );
    }

    const totalSize = filesWithPaths.reduce((acc, f) => acc + f.size, 0);
    console.log(
      `[Download] Creating ZIP for ${filesWithPaths.length} files (${(totalSize / 1024 / 1024).toFixed(1)}MB total)`,
    );

    // Create a PassThrough stream to pipe archiver output directly to the response
    const passthrough = new PassThrough();
    const archive = archiver("zip", {
      zlib: { level: 5 }, // Moderate compression for speed
    });

    let bytesStreamed = 0;
    let fileCount = 0;

    // Handle archive warnings and errors
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn(`[Download] Archive warning - file not found: ${err.message}`);
      } else {
        console.error(`[Download] Archive warning:`, err);
      }
    });

    archive.on("error", (err) => {
      console.error("[Download] Archive critical error:", err);
      passthrough.destroy(err);
    });

    // Monitor streaming progress
    passthrough.on("data", (chunk) => {
      bytesStreamed += chunk.length;
      console.log(
        `[Download] Streamed ${(bytesStreamed / 1024 / 1024).toFixed(1)}MB...`,
      );
    });

    passthrough.on("error", (err) => {
      console.error("[Download] PassThrough stream error:", err);
    });

    // Pipe archive data to the passthrough stream with backpressure handling
    archive.pipe(passthrough);

    // Add files to archive with progress logging
    for (const file of filesWithPaths) {
      if (fs.existsSync(file.filePath)) {
        fileCount++;
        console.log(
          `[Download] Adding file ${fileCount}/${filesWithPaths.length}: ${file.fileName} (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        );
        archive.file(file.filePath, { name: file.fileName });
      } else {
        console.warn(
          `[Download] File not found at path: ${file.filePath} for file name: ${file.fileName}`,
        );
      }
    }

    archive.finalize();
    console.log(`[Download] Archive finalized with ${fileCount} files`);

    // Convert Node.js PassThrough stream to Web ReadableStream with timeout protection
    const webStream = new ReadableStream({
      start(controller) {
        let timeoutId: NodeJS.Timeout;
        let streamClosed = false;

        const resetTimeout = () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            console.error("[Download] Stream timeout exceeded (15 min)");
            streamClosed = true;
            const error = new Error(
              "Download stream timeout. Connection was idle too long.",
            );
            passthrough.destroy(error);
            try {
              controller.error(error);
            } catch (e) {
              console.error("[Download] Error closing controller:", e);
            }
          }, DOWNLOAD_TIMEOUT);
        };

        resetTimeout();

        passthrough.on("data", (chunk) => {
          if (streamClosed) return;
          try {
            controller.enqueue(chunk);
            resetTimeout(); // Reset timeout on each chunk received
          } catch (err) {
            console.error("[Download] Error enqueuing chunk:", err);
            streamClosed = true;
            clearTimeout(timeoutId);
          }
        });

        passthrough.on("end", () => {
          clearTimeout(timeoutId);
          streamClosed = true;
          console.log(
            `[Download] Stream completed. Total: ${(bytesStreamed / 1024 / 1024).toFixed(1)}MB`,
          );
          try {
            controller.close();
          } catch (err) {
            console.error("[Download] Error closing stream:", err);
          }
        });

        passthrough.on("error", (err) => {
          clearTimeout(timeoutId);
          streamClosed = true;
          console.error("[Download] PassThrough error:", err);
          try {
            controller.error(err);
          } catch (e) {
            console.error("[Download] Error passing error to controller:", e);
          }
        });
      },
    });

    // Set headers for file download
    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set(
      "Content-Disposition",
      `attachment; filename="selected_images.zip"`,
    );
    // Prevent proxy/cache from timing out or compressing the stream
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.set("Connection", "keep-alive");
    headers.set("Transfer-Encoding", "chunked");

    console.log("[Download] Starting ZIP stream response");
    return new NextResponse(webStream, {
      headers,
      status: 200,
    });
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[Download] Critical error:", errorMsg, error);
    return NextResponse.json(
      { error: `Failed to generate zip file: ${errorMsg}` },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
