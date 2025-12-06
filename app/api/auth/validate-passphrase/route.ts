import { NextResponse } from "next/server";
import prisma from "../../../../prisma/client";
import { serialize } from "cookie";

export async function POST(request: Request) {
  try {
    const { folderId, passphrase } = await request.json();

    if (!folderId || !passphrase) {
      return new NextResponse("Missing folderId or passphrase", {
        status: 400,
      });
    }

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    if (folder.isPrivate && folder.passphrase === passphrase) {
      // Set a secure, HTTP-only cookie for this folder
      const cookie = serialize(`folder_auth_${folderId}`, "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60, // 1 hour
        path: "/", // Accessible across the entire site
      });

      return new NextResponse("Passphrase validated", {
        status: 200,
        headers: { "Set-Cookie": cookie },
      });
    } else {
      return new NextResponse("Invalid passphrase", { status: 401 });
    }
  } catch (error) {
    console.error("Error validating passphrase:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
