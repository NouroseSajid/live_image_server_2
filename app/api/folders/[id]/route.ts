import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "../../../../prisma/client";
import slugify from "slugify";
import path from "node:path";
import fs from "node:fs/promises";

// Helper function to convert BigInt to string for JSON serialization
function serializeBigInt(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(
      obj,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
    ),
  );
}

// Helper to convert absolute file system paths to URL paths
const transformPathToUrl = (path: string) => {
  const publicDir = "public";
  const publicDirIndex = path.indexOf(publicDir);
  if (publicDirIndex === -1) {
    return path;
  }
  return path.substring(publicDirIndex + publicDir.length).replace(/\\/g, "/");
};

interface RouteParams {
  id: string;
}

interface RouteContext {
  params: RouteParams;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params; // Destructure id directly
    const folder = await prisma.folder.findUnique({
      where: { id: id },
      include: {
        files: {
          include: {
            variants: true,
          },
        },
      },
    });

    if (!folder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    const folderWithTransformedPaths = {
      ...folder,
      files: folder.files.map((file) => ({
        ...file,
        variants: file.variants.map((variant) => ({
          ...variant,
          path: transformPathToUrl(variant.path),
        })),
      })),
    };

    // Serialize BigInt fields to string before returning
    return NextResponse.json(serializeBigInt(folderWithTransformedPaths));
  } catch (error) {
    console.error("Error fetching folder:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const params = await paramsPromise;
    const body = await request.json();
    let { name, isPrivate, visible, passphrase, inGridView, folderThumb } =
      body;

    if (!name) {
      return new NextResponse("Missing folder name", { status: 400 });
    }

    // Fetch the existing folder to compare name changes
    const existingFolder = await prisma.folder.findUnique({
      where: { id: params.id },
    });
    if (!existingFolder) {
      return new NextResponse("Folder not found", { status: 404 });
    }

    let updatedUniqueUrl = existingFolder.uniqueUrl;

    // If name changed, regenerate uniqueUrl
    if (name !== existingFolder.name) {
      let baseSlug = slugify(name, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;
      while (
        await prisma.folder.findFirst({
          where: { uniqueUrl: slug, id: { not: params.id } },
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      updatedUniqueUrl = slug;
    }

    const updatedFolder = await prisma.folder.update({
      where: { id: params.id },
      data: {
        name,
        isPrivate,
        visible,
        uniqueUrl: updatedUniqueUrl,
        passphrase,
        inGridView,
        folderThumb,
      },
    });

    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error("Error updating folder:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;

    // Find or create the 'Bin' folder
    let binFolder = await prisma.folder.findUnique({
      where: { name: "Bin" },
    });

    if (!binFolder) {
      binFolder = await prisma.folder.create({
        data: {
          name: "Bin",
          uniqueUrl: "bin",
          isPrivate: true,
          visible: false,
          inGridView: false,
        },
      });
    }

    // Get all files in the folder being deleted, including their variants
    const filesToDelete = await prisma.file.findMany({
      where: { folderId: id },
      include: {
        variants: true,
      },
    });

    const publicDir = path.join(process.cwd(), "public");
    const binFolderPath = path.join(publicDir, "images", binFolder.id);

    for (const file of filesToDelete) {
      for (const variant of file.variants) {
        const oldPath = variant.path;
        const newVariantDir = path.join(binFolderPath, file.id, variant.name);
        await fs.mkdir(newVariantDir, { recursive: true });
        const newPath = path.join(newVariantDir, path.basename(oldPath));

        // Move the physical file
        if (
          await fs
            .access(oldPath)
            .then(() => true)
            .catch(() => false)
        ) {
          await fs.rename(oldPath, newPath);
          console.log(`Moved file from ${oldPath} to ${newPath}`);
        }

        // Update the variant path in the database
        await prisma.variant.update({
          where: { id: variant.id },
          data: { path: newPath },
        });
      }

      // Update the file's folderId to the Bin folder's ID
      await prisma.file.update({
        where: { id: file.id },
        data: { folderId: binFolder.id },
      });
    }

    // Delete the original folder (it should now be empty of files)
    await prisma.folder.delete({
      where: { id: id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting folder:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
