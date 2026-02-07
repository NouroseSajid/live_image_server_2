import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const configPath = join(process.cwd(), "gallery-config.json");

const readConfig = async () => {
  if (!existsSync(configPath)) {
    return {
      allFolderThumbnailUrl: null,
      folderMaxAgeMinutes: {},
      folderOrder: [],
    };
  }
  const data = await readFile(configPath, "utf-8");
  const parsed = JSON.parse(data);
  return {
    allFolderThumbnailUrl: parsed?.allFolderThumbnailUrl ?? null,
    folderMaxAgeMinutes: parsed?.folderMaxAgeMinutes ?? {},
    folderOrder: parsed?.folderOrder ?? [],
  };
};

export async function GET() {
  try {
    const config = await readConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error reading gallery config:", error);
    return NextResponse.json({ allFolderThumbnailUrl: null });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { allFolderThumbnailUrl, folderMaxAgeMinutes, folderOrder } = body || {};

    if (
      allFolderThumbnailUrl !== undefined &&
      allFolderThumbnailUrl !== null &&
      typeof allFolderThumbnailUrl !== "string"
    ) {
      return NextResponse.json(
        { error: "allFolderThumbnailUrl must be a string or null" },
        { status: 400 },
      );
    }

    if (folderMaxAgeMinutes !== undefined) {
      if (
        typeof folderMaxAgeMinutes !== "object" ||
        Array.isArray(folderMaxAgeMinutes)
      ) {
        return NextResponse.json(
          { error: "folderMaxAgeMinutes must be an object" },
          { status: 400 },
        );
      }
      for (const value of Object.values(folderMaxAgeMinutes)) {
        if (value !== null && typeof value !== "number") {
          return NextResponse.json(
            { error: "folderMaxAgeMinutes values must be numbers or null" },
            { status: 400 },
          );
        }
      }
    }

    if (folderOrder !== undefined) {
      if (!Array.isArray(folderOrder)) {
        return NextResponse.json(
          { error: "folderOrder must be an array" },
          { status: 400 },
        );
      }
      for (const value of folderOrder) {
        if (typeof value !== "string") {
          return NextResponse.json(
            { error: "folderOrder items must be strings" },
            { status: 400 },
          );
        }
      }
    }

    const current = await readConfig();
    const config = {
      allFolderThumbnailUrl:
        allFolderThumbnailUrl !== undefined
          ? allFolderThumbnailUrl
          : current.allFolderThumbnailUrl,
      folderMaxAgeMinutes:
        folderMaxAgeMinutes !== undefined
          ? folderMaxAgeMinutes
          : current.folderMaxAgeMinutes,
      folderOrder:
        folderOrder !== undefined ? folderOrder : current.folderOrder,
    };
    await writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating gallery config:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
