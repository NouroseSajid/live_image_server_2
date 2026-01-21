import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  const _session = await getServerSession(authOptions);

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const folderId = searchParams.get("folderId");
    const passphrase = searchParams.get("passphrase");

    // Validate pagination params
    const validLimit = Math.min(Math.max(limit, 1), 100); // Between 1-100
    const validOffset = Math.max(offset, 0);

    // No folderId? Only return public (non-private, visible) images.
    if (!folderId) {
      const repoImages = await prisma.file.findMany({
        where: {
          folder: {
            visible: true,
            isPrivate: false,
          },
        },
        include: {
          folder: true,
          variants: true,
        },
        skip: validOffset,
        take: validLimit,
        orderBy: { createdAt: "desc" },
      });

      const serializedImages = repoImages.map((image) => ({
        ...image,
        fileSize: image.fileSize.toString(),
        variants: image.variants.map((variant) => ({
          ...variant,
          size: variant.size.toString(),
        })),
      }));

      return NextResponse.json(serializedImages);
    }

    // With folderId: enforce passphrase for private folders
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    if (folder.isPrivate && folder.passphrase) {
      if (!passphrase) {
        return new NextResponse("Passphrase required", { status: 401 });
      }
      if (passphrase !== folder.passphrase) {
        return new NextResponse("Invalid passphrase", { status: 403 });
      }
    }

    const repoImages = await prisma.file.findMany({
      where: { folderId },
      include: {
        folder: true,
        variants: true,
      },
      skip: validOffset,
      take: validLimit,
      orderBy: {
        createdAt: "desc",
      },
    });

    const serializedImages = repoImages.map((image) => ({
      ...image,
      fileSize: image.fileSize.toString(),
      variants: image.variants.map((variant) => ({
        ...variant,
        size: variant.size.toString(),
      })),
    }));

    return NextResponse.json(serializedImages);
  } catch (error) {
    console.error("Error fetching repository images:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
