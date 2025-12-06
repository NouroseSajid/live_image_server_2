import { NextResponse, NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const configPath = path.join(process.cwd(), "ingest-config.json");

// Support multiple ingest target folders (array of folder IDs)
const IngestConfigSchema = z.object({
  folderIds: z.array(z.string()),
});

// Helper to read the config file
async function getIngestConfig() {
  try {
    const data = await fs.readFile(configPath, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    // Handle missing file gracefully
    if (err && err.code === "ENOENT") {
      return null; // File doesn't exist
    }
    throw err;
  }
}

// Helper to write to the config file
async function writeIngestConfig(config: { folderIds: string[] }) {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export async function GET() {
  try {
    const config = await getIngestConfig();
    if (config && config.folderIds) {
      return NextResponse.json({ folderIds: config.folderIds });
    }
    return NextResponse.json({ folderIds: [] });
  } catch (error) {
    console.error("Error getting ingest folder config:", error);
    return NextResponse.json(
      { error: "Failed to read ingest configuration." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("[API] POST /api/ingest-folder received body:", body);

    // Accept either { folderId: string } (legacy) or { folderIds: string[] } (preferred)
    let folderIds: string[] = [];
    if (body && Array.isArray(body.folderIds)) {
      folderIds = body.folderIds.map(String);
    } else if (body && body.folderId !== undefined && body.folderId !== null) {
      folderIds = [String(body.folderId)];
    } else {
      console.warn("[API] Invalid request body, no folderIds or folderId found");
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    console.log("[API] Normalized folderIds:", folderIds);

    // Validate the normalized array shape with Zod
    const arrValidation = z.array(z.string()).safeParse(folderIds);
    if (!arrValidation.success) {
      console.warn("[API] Zod validation failed:", arrValidation.error);
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    // Validate that all folder IDs exist in the database
    const existing = await prisma.folder.findMany({
      where: { id: { in: folderIds } },
      select: { id: true, name: true },
    });

    console.log("[API] Folders found in DB:", existing);

    const existingIds = new Set(existing.map((f) => f.id));
    const missing = folderIds.filter((id) => !existingIds.has(id));

    if (missing.length > 0) {
      console.error("[API] Folders not found:", missing);
      return NextResponse.json(
        { error: `Folder(s) not found: ${missing.join(", ")}` },
        { status: 404 },
      );
    }

    // Write the new folder IDs to the config file
    await writeIngestConfig({ folderIds });
    console.log("[API] ✅ Config saved successfully:", { folderIds });

    return NextResponse.json({
      message: "Ingest folders updated successfully.",
      folderIds,
    });
  } catch (err: any) {
    console.error("[API] ❌ Error setting ingest folder:", err);
    return NextResponse.json(
      { error: "Failed to update ingest configuration." },
      { status: 500 },
    );
  }
}
