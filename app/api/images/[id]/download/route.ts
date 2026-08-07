import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../../prisma/client";
import { authOptions } from "../../../auth/[...nextauth]/route";

/**
 * Maps file extensions to proper MIME types.
 * Using the correct Content-Type helps iOS Safari handle Content-Disposition properly.
 */
function getMimeFromExtension(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".ogg": "video/ogg",
    ".ogv": "video/ogg",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
  };
  return mimeMap[ext] || "application/octet-stream";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const quality = searchParams.get("quality") || "original";

  if (!id) {
    return new NextResponse("Image ID not provided", { status: 400 });
  }

  try {
    const file = await prisma.file.findUnique({
      where: { id },
      include: {
        variants: true,
        folder: {
          select: {
            isPrivate: true,
            id: true,
            passphrase: true,
          },
        },
      },
    });

    if (!file) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Require auth for private folder files
    if (file.folder?.isPrivate) {
      let authorized = !!session?.user;

      if (!authorized) {
        // Check for passphrase in query param
        const pass = searchParams.get("passphrase");
        if (pass && pass === file.folder.passphrase) {
          authorized = true;
        }

        // Check for token in query param or cookie
        const tokenParam = searchParams.get("t") || searchParams.get("token");
        const cookieName = `access_folder_${file.folder.id}`;
        const tokenFromCookie = request.cookies.get(cookieName)?.value;
        const token = tokenParam || tokenFromCookie;

        if (!authorized && token) {
          const link = await prisma.accessLink.findUnique({
            where: { token },
          });
          if (
            link &&
            link.folderId === file.folder.id &&
            (!link.expiresAt || link.expiresAt > new Date()) &&
            (link.usesLeft === null || link.usesLeft > 0)
          ) {
            authorized = true;
          }
        }
      }

      if (!authorized) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
    }

    const variant = file.variants.find((v) => v.name === quality);

    if (!variant) {
      return new NextResponse("Requested quality not found", { status: 404 });
    }

    // Path traversal protection
    if (variant.path.includes("..") || join(variant.path).startsWith("..")) {
      return new NextResponse("Invalid file path", { status: 400 });
    }

    const filePath = join(process.cwd(), "image_repo", variant.path);

    try {
      const stats = await stat(filePath);
      const stream = createReadStream(filePath);
      const webStream = Readable.toWeb(stream);

      // Use actual file extension to determine MIME type
      const mimeType = getMimeFromExtension(file.fileName);

      // UTF-8 encoded filename for international support (iOS requirement)
      const encodedFilename = encodeURIComponent(file.fileName);

      const headers = new Headers();
      headers.set(
        "Content-Disposition",
        `attachment; filename="${file.fileName}"; filename*=UTF-8''${encodedFilename}`,
      );
      headers.set("Content-Type", mimeType);
      headers.set("Content-Length", stats.size.toString());

      return new NextResponse(webStream as unknown as BodyInit, { headers });
    } catch (_error) {
      return new NextResponse("File not found on disk", { status: 404 });
    }
  } catch (error) {
    console.error("Error downloading file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
