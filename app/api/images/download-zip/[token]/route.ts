// app/api/images/download-zip/[token]/route.ts

import { access } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../prisma/client";
import { getSession, deleteSession } from "../sessionStore";

const DOWNLOAD_TIMEOUT = 15 * 60 * 1000; // 15 minutes

/**
 * Sends a progress event to the SSE endpoint.
 */
function sendInternalEvent(payload: any) {
  const body = JSON.stringify(payload);
  const appPort = parseInt(process.env.PORT || "3000", 10);

  const req = http.request(
    {
      hostname: "localhost",
      port: appPort,
      path: "/api/events",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.INTERNAL_SECRET || "ingest-123",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => {
      res.on("data", () => {});
      res.on("end", () => {});
    },
  );

  req.on("error", () => {});
  req.write(body);
  req.end();
}

function broadcastDownloadProgress(
  downloadId: string,
  current: number,
  total: number,
  percent: number,
) {
  sendInternalEvent({
    type: "download-progress",
    payload: { downloadId, current, total, percent },
  });
}

function broadcastDownloadComplete(downloadId: string) {
  sendInternalEvent({
    type: "download-complete",
    payload: { downloadId },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Look up session
  const session = await getSession(token);
  if (!session) {
    return NextResponse.json(
      { error: "Download session not found or expired. Please try again." },
      { status: 404 },
    );
  }

  const { imageIds, quality, downloadId } = session;

  try {
    // Fetch files with variants
    const filesToZip = await prisma.file.findMany({
      where: { id: { in: imageIds } },
      include: {
        variants: true,
        folder: {
          select: { id: true, isPrivate: true, passphrase: true },
        },
      },
    });

    if (filesToZip.length === 0) {
      return NextResponse.json({ error: "No images found." }, { status: 404 });
    }

    // Resolve file paths
    const filesWithPaths = filesToZip
      .map((file) => {
        let variant =
          file.variants.find((v) => v.name === quality) ||
          file.variants.find((v) => v.name === "original") ||
          file.variants[0];

        if (!variant) return null;

        // Path traversal protection
        if (variant.path.includes("..")) {
          console.error(`Blocked suspicious path: ${variant.path}`);
          return null;
        }

        const filePath = path.join(process.cwd(), "image_repo", variant.path);
        return {
          fileName: file.fileName,
          filePath: filePath,
          size: Number(variant.size) || 0,
        };
      })
      .filter((f): f is NonNullable<typeof f> => !!f);

    if (filesWithPaths.length === 0) {
      return NextResponse.json({ error: "No files available." }, { status: 400 });
    }

    const totalSize = filesWithPaths.reduce((acc, f) => acc + f.size, 0);
    const passthrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 5 } });
    const finalDownloadId = downloadId || `dl-${Date.now()}`;

    archive.on("error", (err) => passthrough.destroy(err));
    archive.pipe(passthrough);

    // Add files to archive
    for (const file of filesWithPaths) {
      try {
        await access(file.filePath);
        archive.file(file.filePath, { name: file.fileName });
      } catch {
        console.warn(`File missing: ${file.filePath}`);
      }
    }
    archive.finalize();

    const webStream = new ReadableStream({
      start(controller) {
        let timeoutId: NodeJS.Timeout;
        let lastPercent = -1;

        const resetTimeout = () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            passthrough.destroy(new Error("Download timeout"));
            controller.error("Timeout");
          }, DOWNLOAD_TIMEOUT);
        };

        resetTimeout();

        passthrough.on("data", (chunk) => {
          resetTimeout();
          controller.enqueue(chunk);

          // Backpressure handling
          if (controller.desiredSize !== null && controller.desiredSize <= 0) {
            passthrough.pause();
          }

          // Throttled progress broadcast
          const bytesStreamed = (archive as any).pointer?.() || 0;
          const currentPercent = Math.floor(
            (bytesStreamed / totalSize) * 100,
          );
          if (currentPercent > lastPercent) {
            lastPercent = currentPercent;
            broadcastDownloadProgress(
              finalDownloadId,
              bytesStreamed,
              totalSize,
              currentPercent,
            );
          }
        });

        passthrough.on("end", () => {
          clearTimeout(timeoutId);
          broadcastDownloadComplete(finalDownloadId);
          controller.close();
          // Clean up session after download completes
          deleteSession(token).catch(() => {});
        });

        passthrough.on("error", (err) => {
          clearTimeout(timeoutId);
          controller.error(err);
        });
      },
      pull() {
        passthrough.resume();
      },
      cancel() {
        passthrough.destroy();
        archive.abort();
        deleteSession(token).catch(() => {});
      },
    });

    const encodedFilename = encodeURIComponent("selected_images.zip");
    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set(
      "Content-Disposition",
      `attachment; filename="selected_images.zip"; filename*=UTF-8''${encodedFilename}`,
    );
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return new NextResponse(webStream, { headers, status: 200 });
  } catch (error) {
    console.error("[Download] Critical error:", error);
    await deleteSession(token);
    return NextResponse.json(
      { error: "Failed to generate zip file" },
      { status: 500 },
    );
  }
}
