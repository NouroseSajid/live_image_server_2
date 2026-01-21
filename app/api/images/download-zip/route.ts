// app/api/images/download-zip/route.ts

import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import { PrismaClient } from "@prisma/client";
import archiver from "archiver";
import { type NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { imageIds, quality = "webp" } = await req.json();

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json(
        { error: "No image IDs provided." },
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
        // The variant.path is stored as `/images/{folderId}/...`
        // so we need to construct the path from public folder
        const filePath = path.join(process.cwd(), "public", variant.path);
        return {
          fileName: file.fileName,
          filePath: filePath,
        };
      })
      .filter(Boolean); // Remove null entries

    if (filesWithPaths.length === 0) {
      return NextResponse.json(
        { error: "No image files available for download." },
        { status: 404 },
      );
    }

    // Create a PassThrough stream to pipe archiver output directly to the response
    const passthrough = new PassThrough();
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    });

    // Pipe archive data to the passthrough stream
    archive.pipe(passthrough);

    for (const file of filesWithPaths) {
      if (fs.existsSync(file.filePath)) {
        console.log(
          `Adding file to archive: ${file.fileName} from ${file.filePath}`,
        );
        archive.file(file.filePath, { name: file.fileName });
      } else {
        console.warn(
          `File not found at path: ${file.filePath} for file name: ${file.fileName}`,
        );
      }
    }

    archive.finalize();

    // Convert Node.js PassThrough stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        passthrough.on("data", (chunk) => {
          controller.enqueue(chunk);
        });
        passthrough.on("end", () => {
          controller.close();
        });
        passthrough.on("error", (err) => {
          controller.error(err);
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

    // Return the web stream as the Next.js response
    return new NextResponse(webStream, { headers });
  } catch (error) {
    console.error("Error generating zip file:", error);
    return NextResponse.json(
      { error: "Failed to generate zip file." },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
