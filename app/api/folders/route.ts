import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import slugify from "slugify";
import prisma from "../../../prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);

  try {
    // Always return visible folders to all users; include privacy flags so the client can prompt for passphrases.
    // Admins still see hidden folders for management.
    const folders = await prisma.folder.findMany({
      where: !session || !session.user ? { visible: true } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        visible: true,
        isPrivate: true,
        passphrase: true,
        uniqueUrl: true,
        inGridView: true,
        thumbnail: {
          select: {
            id: true,
            variants: {
              where: { name: "thumbnail" },
              select: {
                path: true,
              },
            },
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
      },
    });
    return NextResponse.json(folders);
  } catch (error) {
    console.error("Error fetching folders:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    let {
      name,
      isPrivate,
      visible,
      uniqueUrl,
      passphrase,
      inGridView,
      folderThumbnailId,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing folder name" },
        { status: 400 },
      );
    }

    if (!uniqueUrl) {
      const baseSlug = slugify(name, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.folder.findUnique({ where: { uniqueUrl: slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      uniqueUrl = slug;
    } else {
      // If uniqueUrl is provided, ensure it's unique
      const existingFolder = await prisma.folder.findUnique({
        where: { uniqueUrl },
      });
      if (existingFolder) {
        return NextResponse.json(
          { error: "Unique URL already exists" },
          { status: 409 },
        );
      }
    }

    const newFolder = await prisma.folder.create({
      data: {
        name,
        isPrivate: isPrivate || false,
        visible: visible || false,
        uniqueUrl,
        passphrase,
        inGridView: inGridView || false,
        folderThumbnailId,
      },
    });

    return NextResponse.json(newFolder, { status: 201 });
  } catch (error) {
    console.error("Error creating folder:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint failed
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "A record with this unique field already exists" },
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
