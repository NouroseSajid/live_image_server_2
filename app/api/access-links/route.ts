import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import prisma from "../../../prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const folderId = new URL(request.url).searchParams.get("folderId");
  try {
    const links = await prisma.accessLink.findMany({
      where: {
        ...(folderId ? { folderId } : {}),
        isPermanent: true,
      },
      select: {
        id: true,
        token: true,
        folderId: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
        isPermanent: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(links);
  } catch (error) {
    console.error("Error listing access links:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { folderId, expiresAt, usesLeft, permanent } = body;

    if (!folderId) {
      return NextResponse.json(
        { error: "folderId is required" },
        { status: 400 },
      );
    }

    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const isPermanent = permanent === true;
    const link = await prisma.accessLink.create({
      data: {
        folderId,
        // Permanent links never expire, have unlimited uses and hide the
        // passphrase behind a revocable token.
        expiresAt: isPermanent
          ? null
          : expiresAt
            ? new Date(expiresAt)
            : null,
        usesLeft: isPermanent
          ? null
          : typeof usesLeft === "number"
            ? usesLeft
            : 1,
        isPermanent,
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("Error creating access link:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
