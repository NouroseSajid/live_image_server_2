import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const folderIds = Array.isArray(body?.folderIds) ? body.folderIds : null;

    if (!folderIds || folderIds.some((id: unknown) => typeof id !== "string")) {
      return NextResponse.json(
        { error: "folderIds must be an array of strings" },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.folderOrder.deleteMany({}),
      prisma.folderOrder.createMany({
        data: folderIds.map((folderId: string, index: number) => ({
          folderId,
          position: index,
        })),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving folder order:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
