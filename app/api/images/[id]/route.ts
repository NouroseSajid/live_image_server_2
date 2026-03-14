import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const publicPathToAbsolute = (publicPath: string) =>
  join(process.cwd(), "image_repo", publicPath.replace(/^\/+/, ""));

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
      include: { variants: true },
    });

    if (!file) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Delete from database first to prevent serving during cleanup
    await prisma.file.delete({
      where: { id },
    });

    // Clean up variant files from disk
    for (const variant of file.variants) {
      if (!variant.path.startsWith("/images/")) continue;
      const absPath = publicPathToAbsolute(variant.path);
      try {
        await unlink(absPath);
      } catch (e) {
        // File may already be gone — not an error
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error("Error deleting variant from disk:", e);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
