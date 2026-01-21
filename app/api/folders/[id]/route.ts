import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import slugify from "slugify";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const folder = await prisma.folder.findUnique({
      where: { id: params.id },
    });

    if (!folder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    return NextResponse.json(folder);
  } catch (error) {
    console.error("Error fetching folder:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
      folderThumb,
    } = body;

    if (!name) {
      return new NextResponse("Missing folder name", { status: 400 });
    }

    // Fetch the existing folder to compare name changes
    const existingFolder = await prisma.folder.findUnique({
      where: { id: params.id },
    });
    if (!existingFolder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    // If name changed and uniqueUrl not explicitly provided, regenerate uniqueUrl
    if (name !== existingFolder.name && !uniqueUrl) {
      const baseSlug = slugify(name, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;
      while (
        await prisma.folder.findFirst({
          where: { uniqueUrl: slug, id: { not: params.id } },
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      uniqueUrl = slug;
    } else if (uniqueUrl && uniqueUrl !== existingFolder.uniqueUrl) {
      // If uniqueUrl is provided and changed, ensure it's unique (excluding current folder)
      const conflictFolder = await prisma.folder.findFirst({
        where: { uniqueUrl, id: { not: params.id } },
      });
      if (conflictFolder) {
        return new NextResponse("Unique URL already exists", { status: 409 });
      }
    }

    const updatedFolder = await prisma.folder.update({
      where: { id: params.id },
      data: {
        name,
        isPrivate,
        visible,
        uniqueUrl,
        passphrase,
        inGridView,
        folderThumb,
      },
    });

    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error("Error updating folder:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    await prisma.folder.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting folder:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
