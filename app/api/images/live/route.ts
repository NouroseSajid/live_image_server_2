import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "../../../../prisma/client";

export async function GET(request: NextRequest) {
  const cookies = request.cookies;

  const transformPathToUrl = (path: string) => {
    const publicDir = "public";
    const publicDirIndex = path.indexOf(publicDir);
    if (publicDirIndex === -1) {
      return path;
    }
    return path
      .substring(publicDirIndex + publicDir.length)
      .replace(/\\/g, "/");
  };

  try {
    const liveImages = await prisma.file.findMany({
      where: {
        isLive: true,
      },
      include: {
        folder: true,
        variants: true,
      },
    });

    const filteredImages = liveImages.filter((image) => {
      if (image.folder?.isPrivate) {
        const authCookieName = `folder_auth_${image.folder.id}`;
        return (
          cookies.has(authCookieName) &&
          cookies.get(authCookieName)?.value === "true"
        );
      }
      return true; // Public images are always returned
    });

    const imagesWithUrls = filteredImages.map((image) => ({
      ...image,
      variants: image.variants.map((variant) => ({
        ...variant,
        path: transformPathToUrl(variant.path),
      })),
    }));

    return NextResponse.json(imagesWithUrls);
  } catch (error) {
    console.error("Error fetching live images:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
