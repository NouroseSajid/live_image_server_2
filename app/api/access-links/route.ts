import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { folderId, expiresAt, usesLeft } = body;

    if (!folderId) {
      return NextResponse.json({ error: "folderId is required" }, { status: 400 });
    }

    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const link = await prisma.accessLink.create({
      data: {
        folderId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        usesLeft: typeof usesLeft === "number" ? usesLeft : 1,
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("Error creating access link:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
