import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import sharp from "sharp";
import prisma from "../../../../../prisma/client";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id: folderId } = params;

  if (!folderId) {
    return new NextResponse("Missing folderId", { status: 400 });
  }

  const tempFolder = path.join(process.cwd(), "tmp");
  await fs.mkdir(tempFolder, { recursive: true });
  // Use a unique name for the temporary file to avoid conflicts
  const tempFileName = `${folderId}-${Date.now()}`;
  const tempFilePath = path.join(tempFolder, tempFileName);

  try {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    if (!request.body) {
      return new NextResponse("Missing file data", { status: 400 });
    }

    // Stream the request body to a temporary file
    await pipeline(request.body, createWriteStream(tempFilePath));

    // Define thumbnail storage
    const thumbnailDir = path.join(
      process.cwd(),
      "public",
      "thumbnails",
      "folders",
    );
    await fs.mkdir(thumbnailDir, { recursive: true });
    const thumbnailFileName = `${folderId}-${Date.now()}.webp`;
    const thumbnailPath = path.join(thumbnailDir, thumbnailFileName);

    // Process the image with sharp
    await sharp(tempFilePath)
      .resize(400, 400, { fit: "inside" })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);

    // Construct the public URL
    const thumbnailUrl = `/thumbnails/folders/${thumbnailFileName}`;

    // Update the folder record in the database
    const _updatedFolder = await prisma.folder.update({
      where: { id: folderId },
      data: {
        folderThumb: thumbnailUrl,
      },
    });

    return NextResponse.json({ thumbnailUrl });
  } catch (error) {
    console.error("Error uploading thumbnail:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  } finally {
    // Clean up the temporary file
    await fs
      .unlink(tempFilePath)
      .catch((err) =>
        console.error(`Failed to delete temp file: ${tempFilePath}`, err),
      );
  }
}
