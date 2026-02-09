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
    const { groupIds } = body || {};

    if (!Array.isArray(groupIds)) {
      return NextResponse.json(
        { error: "groupIds must be an array" },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      groupIds.map((id: string, index: number) =>
        prisma.folderGroup.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving folder group order:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
