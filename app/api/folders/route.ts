import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getServerSession } from "next-auth/next";
import slugify from "slugify";
import prisma from "../../../prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const scope = request.nextUrl.searchParams.get("scope");

  const configPath = join(process.cwd(), "gallery-config.json");
  const readFolderOrder = async () => {
    try {
      if (!existsSync(configPath)) return [] as string[];
      const data = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(data);
      return Array.isArray(parsed?.folderOrder) ? parsed.folderOrder : [];
    } catch {
      return [] as string[];
    }
  };

  try {
    // Public scope should always hide non-visible folders, even for admins.
    // Admins (no scope) see all folders for management.
    const folders = await prisma.folder.findMany({
      where:
        scope === "public"
          ? { visible: true }
          : !session || !session.user
            ? { visible: true }
            : undefined,
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
    const order = await readFolderOrder();
    if (order.length) {
      const orderMap = new Map(order.map((id, index) => [id, index]));
      const sorted = [...folders].sort((a, b) => {
        const aIndex = orderMap.get(a.id);
        const bIndex = orderMap.get(b.id);
        if (aIndex === undefined && bIndex === undefined) return 0;
        if (aIndex === undefined) return 1;
        if (bIndex === undefined) return -1;
        return aIndex - bIndex;
      });
      return NextResponse.json(sorted);
    }

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
