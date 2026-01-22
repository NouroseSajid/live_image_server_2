import { NextResponse } from "next/server";
import prisma from "../../../../prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token;

  try {
    const link = await prisma.accessLink.findUnique({ where: { token } });
    if (!link) {
      return new NextResponse("Invalid access link", { status: 404 });
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      return new NextResponse("Access link expired", { status: 410 });
    }

    // Decrement usesLeft if limited
    if (typeof link.usesLeft === "number" && link.usesLeft > 0) {
      await prisma.accessLink.update({
        where: { token },
        data: { usesLeft: link.usesLeft - 1 },
      });
    } else if (link.usesLeft !== null && link.usesLeft <= 0) {
      return new NextResponse("Access link exhausted", { status: 410 });
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
