import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
  const _session = await getServerSession(authOptions);

  // Decide if authentication is required for live images.
  // For now, assuming live images are public.
  // if (!session || !session.user) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }

  try {
    const liveImages = await prisma.file.findMany({
      where: {
        OR: [
          { isLive: true }, // Live mode files
          { folder: { inGridView: true } }, // Files in folders marked for grid view
        ],
      },
      include: {
        folder: true, // Include folder information if needed
        variants: true, // Include variants for different image sizes/formats
      },
      orderBy: {
        createdAt: "desc", // Show newest first
      },
    });
    return NextResponse.json(liveImages);
  } catch (error) {
    console.error("Error fetching live images:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
