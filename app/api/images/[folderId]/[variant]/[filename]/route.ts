import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Dynamic image serving route that bypasses Next.js public folder caching
 * Serves images directly from disk based on variant and filename
 *
 * Usage: /api/images/[folderId]/[variant]/[filename]
 * Example: /api/images/cmkolz37x0000pvvjeuyeojez/thumbs/Batch%20(37%20of%2094)_thumb.webp
 */
export async function GET(
  _request: NextRequest,
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
    const stream = createReadStream(filePath);

    // Determine MIME type based on extension
    let mimeType = "application/octet-stream";
    if (filename.endsWith(".webp")) mimeType = "image/webp";
    else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg"))
      mimeType = "image/jpeg";
    else if (filename.endsWith(".png")) mimeType = "image/png";

    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Content-Length", stats.size.toString());
    // Cache for 1 year since filenames are immutable
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(stream as unknown as BodyInit, { headers });
  } catch (_error) {
    return new NextResponse("File not found", { status: 404 });
  }
}
