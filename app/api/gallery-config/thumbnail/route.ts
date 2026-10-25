import { existsSync } from "node:fs";
import { readFile, writeFile as writeTextFile } from "node:fs/promises";
import path, { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { processImageUpload } from "../../../lib/imageProcessing";
import { authOptions } from "../../auth/[...nextauth]/route";

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

const writeConfig = async (allFolderThumbnailUrl: string | null) => {
  const current = await readConfig();
  const config = {
    ...current,
    allFolderThumbnailUrl,
  };
  await writeTextFile(configPath, JSON.stringify(config, null, 2));
};

/**
 * Uploads the "All folders" thumbnail used on the main gallery.
 * Stored under the `_all` image-repo folder; the resulting URL is persisted
 * in gallery-config.json.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Invalid file type. Only images allowed." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Unique base name so re-uploads never collide with existing files.
    const originalExtension = path.extname(file.name) || ".jpg";
    const safeBaseName = path
      .basename(file.name, originalExtension)
      .replace(/[^a-zA-Z0-9-_]/g, "_");
    const uniqueBaseName = `${safeBaseName}_${Date.now()}`;
    const originalFileName = `${uniqueBaseName}${originalExtension}`;

    const processed = await processImageUpload({
      buffer,
      originalFileName,
      dbFolder: "_all",
      baseName: uniqueBaseName,
    });

    if (
      !processed.original.size ||
      !processed.webp.size ||
      !processed.thumbnail.size
    ) {
      return NextResponse.json(
        { error: "Failed to write thumbnail files" },
        { status: 500 },
      );
    }

    await writeConfig(processed.thumbnail.dbPath);

    return NextResponse.json({
      allFolderThumbnailUrl: processed.thumbnail.dbPath,
    });
  } catch (error) {
    console.error("Error uploading all folder thumbnail:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
