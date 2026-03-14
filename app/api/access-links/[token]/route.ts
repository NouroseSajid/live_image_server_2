import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../../prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const link = await prisma.accessLink.findUnique({ where: { token } });
    if (!link) {
      return new NextResponse("Invalid access link", { status: 404 });
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      return new NextResponse("Access link expired", { status: 410 });
    }

    // Atomic decrement usesLeft to prevent race conditions
    if (link.usesLeft !== null) {
      if (link.usesLeft <= 0) {
        return new NextResponse("Access link exhausted", { status: 410 });
      }
      const updated = await prisma.accessLink.updateMany({
        where: { token, usesLeft: { gt: 0 } },
        data: { usesLeft: { decrement: 1 } },
      });
      if (updated.count === 0) {
        return new NextResponse("Access link exhausted", { status: 410 });
      }
    }

    const cookieName = `access_folder_${link.folderId}`;
    const expires = link.expiresAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const res = NextResponse.json({ folderId: link.folderId });
    res.cookies.set(cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires,
    });

    return res;
  } catch (error) {
    console.error("Error validating access link:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
