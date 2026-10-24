// app/api/images/download-zip/[token]/route.ts

import { access } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../../prisma/client";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { deleteSession, getSession } from "../sessionStore";

const DOWNLOAD_TIMEOUT = 15 * 60 * 1000; // 15 minutes

interface InternalDownloadEvent {
  type: "download-progress" | "download-complete";
  payload: {
    downloadId: string;
    current?: number;
    total?: number;
    percent?: number;
  };
}

/**
 * Sends a progress event to the SSE endpoint.
 */
function sendInternalEvent(payload: InternalDownloadEvent) {
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
  const authSession = await getServerSession(authOptions);

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
        const variant =
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
          fileId: file.id,
          fileName: file.fileName,
          filePath: filePath,
          size: Number(variant.size) || 0,
        };
      })
      .filter((f): f is NonNullable<typeof f> => !!f);

    if (filesWithPaths.length === 0) {
      return NextResponse.json(
        { error: "No files available." },
        { status: 400 },
      );
    }

    // Only archive files that actually exist on disk. A variant row can exist
    // in the DB while its bytes are gone; those are skipped with a warning.
    // If nothing remains we fail explicitly (400) instead of silently
    // streaming an empty zip — an empty "successful" download is worse than
    // a clear error the client can surface.
    const availableFiles: typeof filesWithPaths = [];
    for (const file of filesWithPaths) {
      try {
        await access(file.filePath);
        availableFiles.push(file);
      } catch {
        console.warn(`File missing: ${file.filePath}`);
      }
    }

    if (availableFiles.length === 0) {
      await deleteSession(token).catch(() => {});
      return NextResponse.json(
        { error: "No files available on disk." },
        { status: 400 },
      );
    }

    const totalSize = availableFiles.reduce((acc, f) => acc + f.size, 0);
    const passthrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 5 } });
    const finalDownloadId = downloadId || `dl-${Date.now()}`;

    archive.on("error", (err) => passthrough.destroy(err));
    archive.pipe(passthrough);

    // Add files to archive
    for (const file of availableFiles) {
      archive.file(file.filePath, { name: file.fileName });
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
          const bytesStreamed = archive.pointer() || 0;
          // Guard against a zero/unknown total size (missing variant sizes in
          // the DB) and clamp to 100: archiver's pointer is compressed bytes,
          // which can slightly exceed the uncompressed sum for tiny files.
          const currentPercent =
            totalSize > 0
              ? Math.min(100, Math.floor((bytesStreamed / totalSize) * 100))
              : 0;
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

          // Count the archive only once it has streamed to completion, and
          // only for visitors. Abandoned or cancelled sessions never get here.
          if (!authSession?.user) {
            void prisma.file
              .updateMany({
                where: { id: { in: availableFiles.map((f) => f.fileId) } },
                data: {
                  downloadCount: { increment: 1 },
                  lastDownloadedAt: new Date(),
                },
              })
              .catch((err) =>
                console.error("Failed to record zip downloads:", err),
              );
          }

          controller.close();
          // Clean up session after download completes
          deleteSession(token).catch(() => {});
        });

        passthrough.on("error", (err) => {
          clearTimeout(timeoutId);
          controller.error(err);
          // Release the session so the client's polling fallback (which
          // treats a 404 as terminal) can resolve instead of hanging.
          deleteSession(token).catch(() => {});
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
