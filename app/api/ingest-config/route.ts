import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";

const configPath = join(process.cwd(), "ingest-config.json");

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    let config = null;
    if (existsSync(configPath)) {
      const data = await readFile(configPath, "utf-8");
      config = JSON.parse(data);
    }

    return NextResponse.json(config || { folderId: null });
  } catch (error) {
    console.error("Error reading ingest config:", error);
    return NextResponse.json({ folderId: null });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { folderId } = body;

    if (!folderId) {
      return NextResponse.json(
        { error: "Folder ID is required" },
        { status: 400 },
      );
    }

    // Verify folder exists
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Write config file
    const config = { folderId };
    await writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ success: true, folderId });
  } catch (error) {
    console.error("Error updating ingest config:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
