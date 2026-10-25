import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { getStorage, storageKey } from "../../../../../lib/storage";

/**
 * Dynamic image serving route that bypasses Next.js public folder caching.
 * Reads bytes through the storage driver, so the same URL keeps working when
 * image storage is moved to a local directory outside the project or a bucket.
 *
 * Usage: /api/serve/[folderId]/[variant]/[filename]
 * Example: /api/serve/cmkolz37x0000pvvjeuyeojez/thumbs/Batch%20(37%20of%2094)_thumb.webp
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      folderId: string;
      variant: string;
      filename: string;
    }>;
  },
) {
  const { folderId, variant, filename } = await params;

  // Validate inputs to prevent directory traversal
  if (!folderId || !variant || !filename) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  // Only allow specific variants
  const validVariants = ["original", "webp", "thumbs"];
  if (!validVariants.includes(variant)) {
    return new NextResponse("Invalid variant", { status: 400 });
  }

  // Prevent directory traversal attacks
  if (
    folderId.includes("..") ||
    filename.includes("..") ||
    filename.includes("/")
  ) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  const key = storageKey("images", folderId, variant, filename);

  // Determine MIME type based on extension
  let mimeType = "application/octet-stream";
  if (filename.endsWith(".webp")) mimeType = "image/webp";
  else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg"))
    mimeType = "image/jpeg";
  else if (filename.endsWith(".png")) mimeType = "image/png";
  else if (filename.endsWith(".mp4")) mimeType = "video/mp4";
  else if (filename.endsWith(".webm")) mimeType = "video/webm";
  else if (filename.endsWith(".ogg") || filename.endsWith(".ogv"))
    mimeType = "video/ogg";
  else if (filename.endsWith(".mov")) mimeType = "video/quicktime";
  else if (filename.endsWith(".m4v")) mimeType = "video/x-m4v";

  const headers = new Headers();
  headers.set("Content-Type", mimeType);
  headers.set("Accept-Ranges", "bytes");
  // Cache for 1 year since filenames are immutable
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  const storage = getStorage();

  try {
    const range = request.headers.get("range");
    const match = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;

    if (match) {
      const stats = await storage.stat(key);
      if (!stats) {
        return new NextResponse("File not found", { status: 404 });
      }

      const start = Number(match[1]);
      const requestedEnd = match[2] ? Number(match[2]) : stats.size - 1;
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(requestedEnd) ||
        start >= stats.size ||
        requestedEnd < start
      ) {
        headers.set("Content-Range", `bytes */${stats.size}`);
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers,
        });
      }

      const end = Math.min(requestedEnd, stats.size - 1);
      const { stream } = await storage.read(key, { start, end });
      headers.set("Content-Range", `bytes ${start}-${end}/${stats.size}`);
      headers.set("Content-Length", String(end - start + 1));
      return new NextResponse(Readable.toWeb(stream) as unknown as BodyInit, {
        status: 206,
        headers,
      });
    }

    const { stream, size } = await storage.read(key);
    headers.set("Content-Length", String(size));
    return new NextResponse(Readable.toWeb(stream) as unknown as BodyInit, {
      headers,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse("File not found", { status: 404 });
    }
    console.error(`[serve] Failed to read ${key}:`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
