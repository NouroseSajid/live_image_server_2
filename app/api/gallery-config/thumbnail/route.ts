import { mkdir, readFile, stat, writeFile, writeFile as writeTextFile } from "node:fs/promises";
import path, { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import sharp from "sharp";
import { authOptions } from "../../auth/[...nextauth]/route";
import { existsSync } from "node:fs";

const configPath = join(process.cwd(), "gallery-config.json");

const readConfig = async () => {
  if (!existsSync(configPath)) {
    return { allFolderThumbnailUrl: null, folderMaxAgeMinutes: {}, folderOrder: [] };
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

    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);

    const baseDir = join(process.cwd(), "public", "images", "_all");
    const originalFolder = join(baseDir, "original");
    const webpFolder = join(baseDir, "webp");
    const thumbFolder = join(baseDir, "thumbs");

    await Promise.all([
      mkdir(originalFolder, { recursive: true }),
      mkdir(webpFolder, { recursive: true }),
      mkdir(thumbFolder, { recursive: true }),
    ]);

    const originalExtension = path.extname(file.name) || ".jpg";
    const fileBaseName = path
      .basename(file.name, originalExtension)
      .replace(/[^a-zA-Z0-9-_]/g, "_");
    const uniqueBaseName = `${fileBaseName}_${Date.now()}`;

    const originalFileName = `${uniqueBaseName}${originalExtension}`;
    const webpFileName = `${uniqueBaseName}.webp`;
    const thumbFileName = `${uniqueBaseName}_thumb.webp`;

    const originalPath = join(originalFolder, originalFileName);
    const webpPath = join(webpFolder, webpFileName);
    const thumbPath = join(thumbFolder, thumbFileName);

    await writeFile(originalPath, buffer);

    const rotatedSharp = sharp(buffer, { failOnError: false }).rotate();

    await rotatedSharp.clone().webp({ quality: 85, effort: 6 }).toFile(webpPath);

    await rotatedSharp
      .clone()
      .resize(300, 300, {
        fit: "cover",
        position: "center",
        withoutEnlargement: false,
      })
      .webp({ quality: 80, effort: 6 })
      .toFile(thumbPath);

    const [originalStats, webpStats, thumbStats] = await Promise.all([
      stat(originalPath),
      stat(webpPath),
      stat(thumbPath),
    ]);

    if (!originalStats.size || !webpStats.size || !thumbStats.size) {
      return NextResponse.json(
        { error: "Failed to write thumbnail files" },
        { status: 500 },
      );
    }

    const allFolderThumbnailUrl = `/images/_all/thumbs/${thumbFileName}`;

    await writeConfig(allFolderThumbnailUrl);

    return NextResponse.json({ allFolderThumbnailUrl });
  } catch (error) {
    console.error("Error uploading all folder thumbnail:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
