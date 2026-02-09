import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";

interface OrderItemPayload {
  type: "folder" | "group";
  id: string;
}

const buildDefaultOrder = async () => {
  const folderOrderRows = await prisma.folderOrder.findMany({
    orderBy: { position: "asc" },
    select: { folderId: true },
  });
  const orderedFolderIds = folderOrderRows.map((row) => row.folderId);

  const folders = await prisma.folder.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, groupId: true },
  });

  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const orderedFolders = orderedFolderIds.length
    ? orderedFolderIds
        .map((id) => folderMap.get(id))
        .filter((folder): folder is { id: string; groupId: string | null } =>
          Boolean(folder),
        )
    : folders;

  const groups = await prisma.folderGroup.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true },
  });

  const insertedGroups = new Set<string>();
  const items: OrderItemPayload[] = [];

  orderedFolders.forEach((folder) => {
    if (folder.groupId && !insertedGroups.has(folder.groupId)) {
      items.push({ type: "group", id: folder.groupId });
      insertedGroups.add(folder.groupId);
    }
    items.push({ type: "folder", id: folder.id });
  });

  groups.forEach((group) => {
    if (!insertedGroups.has(group.id)) {
      items.push({ type: "group", id: group.id });
      insertedGroups.add(group.id);
    }
  });

  return items;
};

export async function GET() {
  try {
    const existing = await prisma.galleryOrderItem.findMany({
      orderBy: { position: "asc" },
      select: { type: true, folderId: true, groupId: true },
    });

    if (existing.length > 0) {
      const normalized = existing
        .map((item) => ({
          type: item.type,
          id: item.type === "folder" ? item.folderId : item.groupId,
        }))
        .filter((item) => typeof item.id === "string" && item.id.length > 0);
      return NextResponse.json(normalized);
    }

    const defaults = await buildDefaultOrder();
    await prisma.galleryOrderItem.createMany({
      data: defaults.map((item, index) => ({
        type: item.type,
        position: index,
        folderId: item.type === "folder" ? item.id : null,
        groupId: item.type === "group" ? item.id : null,
      })),
    });

    return NextResponse.json(defaults);
  } catch (error) {
    console.error("Error fetching gallery order:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { items } = body || {};

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "items must be an array" }, { status: 400 });
    }

    const normalized: OrderItemPayload[] = items
      .map((item) => ({
        type: item?.type,
        id: item?.id,
      }))
      .filter((item) => item.type === "folder" || item.type === "group")
      .filter((item) => typeof item.id === "string" && item.id.length > 0);

    await prisma.$transaction([
      prisma.galleryOrderItem.deleteMany({}),
      prisma.galleryOrderItem.createMany({
        data: normalized.map((item, index) => ({
          type: item.type,
          position: index,
          folderId: item.type === "folder" ? item.id : null,
          groupId: item.type === "group" ? item.id : null,
        })),
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving gallery order:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
