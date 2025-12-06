import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "../../../../prisma/client";

// Helper to convert BigInts to strings for JSON serialization
function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

export async function GET(request: NextRequest) {
  const _session = await getServerSession(authOptions);
  const cookies = request.cookies;
  const { searchParams } = new URL(request.url);
  const uniqueUrl = searchParams.get("uniqueUrl");

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
    if (uniqueUrl) {
      // Fetch images for a specific folder
      const folder = await prisma.folder.findUnique({
        where: { uniqueUrl },
        include: {
          files: {
            include: {
              variants: true,
            },
          },
        },
      });

      if (!folder) {
        return new NextResponse("Folder not found", { status: 404 });
      }

      if (folder.isPrivate) {
        const authCookieName = `folder_auth_${folder.id}`;
        if (
          !cookies.has(authCookieName) ||
          cookies.get(authCookieName)?.value !== "true"
        ) {
          return new NextResponse("Unauthorized: Private folder", {
            status: 401,
          });
        }
      }

      const filesWithUrls = folder.files.map((file) => ({
        ...file,
        variants: file.variants.map((variant) => ({
          ...variant,
          path: transformPathToUrl(variant.path),
        })),
      }));

      const responseBody = JSON.stringify(filesWithUrls, jsonReplacer);
      return new NextResponse(responseBody, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      // Fetch all images from all public, visible folders
      const files = await prisma.file.findMany({
        where: {
          folder: {
            isPrivate: false,
            visible: true,
          },
        },
        include: {
          variants: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const filesWithUrls = files.map((file) => ({
        ...file,
        variants: file.variants.map((variant) => ({
          ...variant,
          path: transformPathToUrl(variant.path),
        })),
      }));

      const responseBody = JSON.stringify(filesWithUrls, jsonReplacer);
      return new NextResponse(responseBody, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error fetching repo images:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
