import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../../../prisma/client";
import { authOptions } from "../../../../auth/[...nextauth]/route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { fileId } = body || {};

    if (!fileId || typeof fileId !== "string") {
      return NextResponse.json(
        { error: "fileId is required" },
        { status: 400 },
      );
    }

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (file.folderId !== id) {
      return NextResponse.json(
        { error: "File does not belong to this folder" },
        { status: 400 },
      );
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { folderThumbnailId: fileId },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error setting folder thumbnail:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
