import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../../prisma/client";
import { authOptions } from "../../../auth/[...nextauth]/route";

const fileNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    const files = await prisma.file.findMany({
      where: { folderId: id },
      include: { variants: true },
    });

    files.sort((a, b) => {
      const nameCompare = fileNameCollator.compare(a.fileName, b.fileName);
      if (nameCompare !== 0) return nameCompare;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Serialize BigInt to string for JSON
    const serialized = files.map((file) => ({
      ...file,
      fileSize: file.fileSize.toString(),
      variants: file.variants.map((variant) => ({
        ...variant,
        size: variant.size.toString(),
      })),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error fetching files:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const orders: { id: string; order: number }[] = body?.orders || [];

    if (!Array.isArray(orders) || orders.length === 0) {
      return new NextResponse("No orders provided", { status: 400 });
    }

    // Ensure all files belong to this folder
    const fileIds = orders.map((o) => o.id);
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds }, folderId: id },
      select: { id: true },
    });

    if (files.length !== orders.length) {
      return new NextResponse("Some files do not belong to this folder", {
        status: 400,
      });
    }

    await prisma.$transaction(
      orders.map((o) =>
        prisma.file.update({ where: { id: o.id }, data: { order: o.order } }),
      ),
    );

    return new NextResponse("Order updated", { status: 200 });
  } catch (error) {
    console.error("Error updating file order:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
