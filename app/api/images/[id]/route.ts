import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Try to delete file from disk
    try {
      const filePath = join(
        process.cwd(),
        "public",
        "uploads",
        file.folderId,
        file.fileName,
      );
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (e) {
      console.error("Error deleting file from disk:", e);
      // Continue even if file deletion fails
    }

    // Delete from database
    await prisma.file.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
