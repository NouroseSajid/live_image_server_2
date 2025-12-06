import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "../../../../prisma/client";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { imageIds, action, rotation } = body;

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return new NextResponse("Missing or invalid imageIds", { status: 400 });
    }

    if (!action || (action !== "delete" && action !== "orient")) {
      return new NextResponse("Missing or invalid action", { status: 400 });
    }

    if (
      action === "orient" &&
      (typeof rotation === "undefined" || rotation < 1 || rotation > 8)
    ) {
      return new NextResponse(
        "Missing or invalid rotation value for orient action",
        { status: 400 },
      );
    }

    if (action === "delete") {
      await prisma.file.deleteMany({
        where: {
          id: {
            in: imageIds,
          },
        },
      });
      return NextResponse.json({
        message: `Successfully deleted ${imageIds.length} images.`,
      });
    } else if (action === "orient") {
      await prisma.file.updateMany({
        where: {
          id: {
            in: imageIds,
          },
        },
        data: {
          rotation: rotation,
        },
      });
      return NextResponse.json({
        message: `Successfully oriented ${imageIds.length} images to ${rotation}.`,
      });
    }

    return new NextResponse("Invalid action", { status: 400 });
  } catch (error) {
    console.error("Error performing batch image update:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
