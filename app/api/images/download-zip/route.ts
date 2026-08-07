// app/api/images/download-zip/route.ts

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../../prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createSession } from "./sessionStore";

const MAX_BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  try {
    let body: any;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      const imageIdsRaw = formData.get("imageIds");
      body = {
        imageIds:
          typeof imageIdsRaw === "string" ? JSON.parse(imageIdsRaw) : [],
        quality: (formData.get("quality") as string) || "webp",
        downloadId: (formData.get("downloadId") as string) || null,
        passphrase: (formData.get("passphrase") as string) || null,
      };
    } else {
      return NextResponse.json(
        { error: "Unsupported Content-Type" },
        { status: 400 },
      );
    }

    const {
      imageIds,
      quality = "webp",
      downloadId: _providedDownloadId,
      passphrase,
    } = body;

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json({ error: "No image IDs provided." }, { status: 400 });
    }

    if (imageIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Too many images selected (max ${MAX_BATCH_SIZE}).` },
        { status: 400 },
      );
    }

    // Quick DB check — just verify files exist and authorization
    const filesToZip = await prisma.file.findMany({
      where: { id: { in: imageIds } },
      include: {
        folder: {
          select: { id: true, isPrivate: true, passphrase: true },
        },
      },
    });

    if (filesToZip.length === 0) {
      return NextResponse.json({ error: "No images found." }, { status: 404 });
    }

    // Authorization check
    if (!session?.user) {
      const folderIds = new Set(filesToZip.map((f) => f.folder.id));
      for (const folderId of folderIds) {
        const folder = filesToZip.find((f) => f.folder.id === folderId)?.folder;
        if (folder?.isPrivate) {
          let authorized = false;
          if (passphrase && folder.passphrase && passphrase === folder.passphrase) {
            authorized = true;
          }
          if (!authorized) {
            const cookieName = `access_folder_${folderId}`;
            const token = req.cookies.get(cookieName)?.value;
            if (token) {
              const link = await prisma.accessLink.findUnique({
                where: { token },
              });
              if (
                link &&
                link.folderId === folderId &&
                (!link.expiresAt || link.expiresAt > new Date()) &&
                (link.usesLeft === null || link.usesLeft > 0)
              ) {
                authorized = true;
              }
            }
          }
          if (!authorized) {
            return NextResponse.json(
              { error: "Unauthorized access to folders" },
              { status: 401 },
            );
          }
        }
      }
    }

    // Create a download session — actual ZIP generation happens on GET
    const finalDownloadId =
      body.downloadId || `dl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const sessionToken = await createSession({
      imageIds,
      quality,
      passphrase: passphrase || undefined,
      downloadId: finalDownloadId,
    });

    return NextResponse.json({
      sessionToken,
      downloadId: finalDownloadId,
      totalFiles: imageIds.length,
    });
  } catch (error) {
    console.error("[Download] Critical error:", error);
    return NextResponse.json(
      { error: "Failed to initiate download" },
      { status: 500 },
    );
  }
}
