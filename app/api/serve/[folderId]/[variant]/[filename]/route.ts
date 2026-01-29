import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Dynamic image serving route that bypasses Next.js public folder caching
 * Serves images directly from disk based on variant and filename
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

  try {
    const filePath = join(
      process.cwd(),
      "public",
      "images",
      folderId,
      variant,
      filename,
    );

    const stats = await stat(filePath);

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

    const range = request.headers.get("range");
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : stats.size - 1;
        const chunkSize = end - start + 1;
        const stream = createReadStream(filePath, { start, end });
        headers.set("Content-Range", `bytes ${start}-${end}/${stats.size}`);
        headers.set("Content-Length", chunkSize.toString());
        return new NextResponse(stream as unknown as BodyInit, {
          status: 206,
          headers,
        });
      }
    }

    const stream = createReadStream(filePath);
    headers.set("Content-Length", stats.size.toString());
    return new NextResponse(stream as unknown as BodyInit, { headers });
  } catch (_error) {
    return new NextResponse("File not found", { status: 404 });
  }
}
