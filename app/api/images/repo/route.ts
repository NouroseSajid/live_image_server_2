import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  const _session = await getServerSession(authOptions);

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const folderId = searchParams.get("folderId");
    const passphrase = searchParams.get("passphrase");
    const tokenParam = searchParams.get("t") || searchParams.get("token");

    // Validate pagination params
    const validLimit = Math.min(Math.max(limit, 1), 100); // Between 1-100
    const validOffset = Math.max(offset, 0);

    // No folderId? Only return public (non-private, visible) images.
    if (!folderId) {
      const repoImages = await prisma.file.findMany({
        where: {
          folder: {
            visible: true,
            isPrivate: false,
          },
        },
        include: {
          folder: true,
          variants: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: validOffset,
        take: validLimit,
      });

      const serializedImages = repoImages.map((image) => ({
        ...image,
        fileSize: image.fileSize.toString(),
        variants: image.variants.map((variant) => ({
          ...variant,
          size: variant.size.toString(),
        })),
      }));

      return NextResponse.json(serializedImages);
    }

    // With folderId: enforce access
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    const cookieName = `access_folder_${folderId}`;
    const tokenFromCookie = request.cookies.get(cookieName)?.value;
    let accessGranted = false;
    let setAccessCookie = false;
    let tokenToPersist: string | null = null;

    const validateToken = async (token: string | null) => {
      if (!token) return false;
      const link = await prisma.accessLink.findUnique({ where: { token } });
      if (!link) return false;
      if (link.folderId !== folderId) return false;
      if (link.expiresAt && link.expiresAt < new Date()) return false;
      return true;
    };

    if (folder.isPrivate && folder.passphrase) {
      // Passphrase path
      if (passphrase && passphrase === folder.passphrase) {
        accessGranted = true;
      }

      // Token via query param
      if (!accessGranted && (await validateToken(tokenParam))) {
        accessGranted = true;
        setAccessCookie = true;
        tokenToPersist = tokenParam;
      }

      // Cookie path
      if (!accessGranted && (await validateToken(tokenFromCookie || null))) {
        accessGranted = true;
      }

      if (!accessGranted) {
        return new NextResponse("Passphrase or valid token required", {
          status: passphrase ? 403 : 401,
        });
      }
    }

    const repoImages = await prisma.file.findMany({
      where: { folderId },
      include: {
        folder: true,
        variants: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: validOffset,
      take: validLimit,
    });

    const serializedImages = repoImages.map((image) => ({
      ...image,
      fileSize: image.fileSize.toString(),
      variants: image.variants.map((variant) => ({
        ...variant,
        size: variant.size.toString(),
      })),
    }));

    const res = NextResponse.json(serializedImages);

    if (setAccessCookie && tokenToPersist) {
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
      res.cookies.set(cookieName, tokenToPersist, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires,
      });
    }

    return res;
  } catch (error) {
    console.error("Error fetching repository images:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
