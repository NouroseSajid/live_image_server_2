import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import {
  checkAccessLink,
  PERMANENT_LINK_COOKIE_MS,
  TEMP_LINK_COOKIE_MS,
} from "@/app/lib/accessLink";
import prisma from "../../../../prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const link = await prisma.accessLink.findUnique({
      where: { token },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            isPrivate: true,
          },
        },
      },
    });
    if (!link) {
      return new NextResponse("Invalid access link", { status: 404 });
    }

    const check = await checkAccessLink(token, link.folderId);
    if (!check.valid) {
      return new NextResponse("Access link invalid, expired or revoked", {
        status: 410,
      });
    }

    // Permanent links are never decremented. One-time links consume a use
    // atomically so concurrent redemptions cannot exceed the allowance.
    if (!check.permanent && link.usesLeft !== null) {
      const updated = await prisma.accessLink.updateMany({
        where: { token, usesLeft: { gt: 0 } },
        data: { usesLeft: { decrement: 1 } },
      });
      if (updated.count === 0) {
        return new NextResponse("Access link exhausted", { status: 410 });
      }
    }

    const cookieName = `access_folder_${link.folderId}`;
    const expires = new Date(
      Date.now() +
        (check.permanent ? PERMANENT_LINK_COOKIE_MS : TEMP_LINK_COOKIE_MS),
    );

    const res = NextResponse.json({
      folderId: link.folderId,
      folder: link.folder,
      permanent: check.permanent,
    });
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { token } = await params;
  try {
    const result = await prisma.accessLink.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      return new NextResponse("Access link not found", { status: 404 });
    }
    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error("Error revoking access link:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
