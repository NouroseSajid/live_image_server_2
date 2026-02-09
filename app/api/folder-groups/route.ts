import { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  try {
    const groups = await prisma.folderGroup.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        position: true,
      },
    });
    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error fetching folder groups:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const last = await prisma.folderGroup.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const newGroup = await prisma.folderGroup.create({
      data: { name: name.trim(), position: (last?.position ?? -1) + 1 },
      select: { id: true, name: true, position: true },
    });

    return NextResponse.json(newGroup, { status: 201 });
  } catch (error) {
    console.error("Error creating folder group:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "A group with this name already exists" },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
