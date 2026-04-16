// app/api/images/download-zip/route.ts

import { access } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const _WS_SERVER_HOST = process.env.WS_SERVER_HOST || "localhost";
const _WS_SERVER_PORT = parseInt(process.env.WS_SERVER_PORT || "8080", 10);
const DOWNLOAD_TIMEOUT = 15 * 60 * 1000; // 15 minute timeout
const MAX_BATCH_SIZE = 500;

/**
 * Sends internal events (progress, completion) to the SSE endpoint.
 */
function sendInternalEvent(payload: any) {
  const body = JSON.stringify(payload);
  const appPort = parseInt(process.env.PORT || "3000", 10);
  
  const req = http.request({
    hostname: "localhost",
    port: appPort,
    path: "/api/events",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": process.env.INTERNAL_SECRET || "ingest-123",
      "Content-Length": Buffer.byteLength(body),
    },
  }, (res) => {
    // Consume response to avoid memory leaks
    res.on("data", () => {});
    res.on("end", () => {});
  });

  req.on("error", (_err) => {
    // Silent fail for background tasks
  });

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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  try {
    let body: any;
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const imageIdsRaw = formData.get("imageIds");
      body = {
        imageIds: typeof imageIdsRaw === "string" ? JSON.parse(imageIdsRaw) : [],
        quality: formData.get("quality") as string || "webp",
        downloadId: formData.get("downloadId") as string || null,
        passphrase: formData.get("passphrase") as string || null,
      };
    } else {
      return NextResponse.json({ error: "Unsupported Content-Type" }, { status: 400 });
    }

    const { imageIds, quality = "webp", downloadId: providedDownloadId, passphrase } = body;

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json({ error: "No image IDs provided." }, { status: 400 });
    }

    if (imageIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Too many images selected (max ${MAX_BATCH_SIZE}).` },
        { status: 400 },
      );
    }

    const filesToZip = await prisma.file.findMany({
      where: { id: { in: imageIds } },
      include: {
        variants: true,
        folder: {
          select: { id: true, isPrivate: true, passphrase: true }
        }
      },
    });

    if (filesToZip.length === 0) {
      return NextResponse.json({ error: "No images found." }, { status: 404 });
    }

    // Authorization check
    if (!session?.user) {
      const folderIds = new Set(filesToZip.map(f => f.folder.id));
      for (const folderId of folderIds) {
        const folder = filesToZip.find(f => f.folder.id === folderId)?.folder;
        if (folder?.isPrivate) {
          let authorized = false;
          if (passphrase && folder.passphrase && passphrase === folder.passphrase) {
            authorized = true;
          }
          if (!authorized) {
            const cookieName = `access_folder_${folderId}`;
            const token = req.cookies.get(cookieName)?.value;
            if (token) {
              const link = await prisma.accessLink.findUnique({ where: { token } });
              if (link && link.folderId === folderId && (!link.expiresAt || link.expiresAt > new Date()) && (link.usesLeft === null || link.usesLeft > 0)) {
                authorized = true;
              }
            }
          }
          if (!authorized) {
            return NextResponse.json({ error: "Unauthorized access to folders" }, { status: 401 });
          }
        }
      }
    }

    const filesWithPaths = filesToZip
      .map((file) => {
        let variant = file.variants.find((v) => v.name === quality) || 
                      file.variants.find((v) => v.name === "original") || 
                      file.variants[0];

        if (!variant) return null;

        // Path traversal protection
        if (variant.path.includes("..") || path.isAbsolute(variant.path)) {
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
    const finalDownloadId = providedDownloadId || `dl-${Date.now()}`;

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
          const canEnqueue = controller.enqueue(chunk);
          
          // Backpressure handling: pause source if buffer is full
          if (!canEnqueue) {
            passthrough.pause();
          }

          // Throttled progress broadcast (per 1%)
          const bytesStreamed = (archive as any).pointer?.() || 0;
          const currentPercent = Math.floor((bytesStreamed / totalSize) * 100);
          if (currentPercent > lastPercent) {
            lastPercent = currentPercent;
            broadcastDownloadProgress(finalDownloadId, bytesStreamed, totalSize, currentPercent);
          }
        });

        passthrough.on("end", () => {
          clearTimeout(timeoutId);
          broadcastDownloadComplete(finalDownloadId);
          controller.close();
        });

        passthrough.on("error", (err) => {
          clearTimeout(timeoutId);
          controller.error(err);
        });
      },
      pull(controller) {
        // Resume passthrough when controller is ready for more data
        passthrough.resume();
      },
      cancel() {
        passthrough.destroy();
        archive.abort();
      }
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="selected_images.zip"`);
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    // Removed Connection: keep-alive as it conflicts with chunked on iOS Safari
    // Transfer-Encoding: chunked is automatically set by Next.js for ReadableStream

    return new NextResponse(webStream, { headers, status: 200 });
  } catch (error) {
    console.error("[Download] Critical error:", error);
    return NextResponse.json({ error: "Failed to generate zip file" }, { status: 500 });
  }
}
