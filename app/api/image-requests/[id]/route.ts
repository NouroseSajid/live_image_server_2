import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const VALID_STATUSES = ["PENDING", "FULFILLED", "DISMISSED"] as const;
type RequestStatusValue = (typeof VALID_STATUSES)[number];

function isStatus(value: string): value is RequestStatusValue {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  const status =
    typeof body?.status === "string" ? body.status.toUpperCase() : "";

  if (!isStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const existing = await prisma.imageRequest.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const updated = await prisma.imageRequest.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update image request:", error);
    return NextResponse.json(
      { error: "Failed to update request" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await prisma.imageRequest.deleteMany({ where: { id } });

    if (result.count === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete image request:", error);
    return NextResponse.json(
      { error: "Failed to delete request" },
      { status: 500 },
    );
  }
}
