console.log("watch-ingest.cjs script is starting...");

const chokidar = require("chokidar");
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { PrismaClient } = require("@prisma/client");
const { fileTypeFromBuffer } = require("file-type");
const crypto = require("node:crypto");

const prisma = new PrismaClient();
const ingestFolder = path.join(__dirname, "..", "public", "ingest");

let liveFolderId = null;

// Simple queue for concurrency control
const processingQueue = [];
let processing = false;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function findOrCreateLiveFolder() {
  try {
    log("Checking for existing LIVE folder...");

    let folder = await prisma.folder.findFirst({
      where: {
        name: {
          contains: "live",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!folder) {
      log(`No 'LIVE' folder found. Creating a new one...`);
      folder = await prisma.folder.create({
        data: {
          name: "LIVE 1",
          uniqueUrl: `live-1-${crypto.randomBytes(4).toString("hex")}`,
          isPrivate: false,
          visible: true,
          inGridView: true,
          folderThumb: "/placeholder-folder.jpg",
        },
      });
      log(`'LIVE 1' folder created with ID: ${folder.id}`);
    } else {
      log(`Found existing LIVE folder: ${folder.name} (ID: ${folder.id})`);
    }

    liveFolderId = folder.id;
  } catch (error) {
    console.error("Error while handling LIVE folder:", error);
    process.exit(1);
  }
}

// Enqueue file paths to process one by one
async function enqueueFile(filePath) {
  processingQueue.push(filePath);
  if (!processing) {
    processing = true;
    while (processingQueue.length > 0) {
      const nextFile = processingQueue.shift();
      try {
        await processFile(nextFile);
      } catch (error) {
        log(`Error processing file in queue: ${error.message}`);
      }
    }
    processing = false;
  }
}

async function processFile(filePath) {
  try {
    // Check if file still exists (could have been moved/deleted)
    await fs.access(filePath);

    // Read file buffer and detect type early to ignore unsupported
    const fileBuffer = await fs.readFile(filePath);
    const fileTypeResult = await fileTypeFromBuffer(fileBuffer);

    if (!fileTypeResult) {
      log(`Skipping unsupported file (unknown type): ${filePath}`);
      await fs.unlink(filePath);
      return;
    }

    const mime = fileTypeResult.mime;
    const isImage = mime.startsWith("image/");
    const isVideo = mime.startsWith("video/");

    if (!isImage && !isVideo) {
      log(`Skipping unsupported file (not image/video): ${filePath}`);
      await fs.unlink(filePath);
      return;
    }

    if (isVideo) {
      // For now, just move video original to storage (no conversion)
      await processVideo(filePath, fileTypeResult);
    } else if (isImage) {
      await processImage(filePath, fileBuffer);
    }
  } catch (error) {
    log(`Error processing file ${filePath}: ${error.message}`);
  }
}

async function processVideo(filePath, fileTypeResult) {
  const fileName = path.basename(filePath);
  const fileExtension = path.extname(filePath);
  const fileBaseName = path.basename(fileName, fileExtension);

  log(`Processing video file: ${fileName}`);

  const targetFolderId = liveFolderId;

  // Create permanent storage folders
  const permanentFolderBase = path.join(
    __dirname,
    "..",
    "public",
    "images",
    String(targetFolderId)
  );
  const originalFolder = path.join(permanentFolderBase, "original");

  try {
    await fs.mkdir(originalFolder, { recursive: true });

    const originalPath = path.join(originalFolder, fileName);

    // Move video file to permanent original folder
    await fs.rename(filePath, originalPath);
    log(`Moved video original to: ${originalPath}`);

    const fileStats = await fs.stat(originalPath);
    const videoBuffer = await fs.readFile(originalPath);
    const hash = crypto.createHash("md5").update(videoBuffer).digest("hex");

    // Check for duplicates
    const existing = await prisma.file.findFirst({
      where: { hash: hash },
    });

    if (existing) {
      log(`Duplicate video detected! Deleting ${fileName} and skipping.`);
      await fs.unlink(originalPath);
      return;
    }

    // Save video file record (no variants for now)
    const newFile = await prisma.file.create({
      data: {
        fileName,
        hash,
        width: null,
        height: null,
        rotation: 0,
        fileSize: BigInt(fileStats.size),
        fileType: "video",
        folderId: targetFolderId,
        variants: {
          create: [
            {
              name: "original",
              path: path.relative(process.cwd(), originalPath),
              size: BigInt(fileStats.size),
            },
          ],
        },
      },
    });

    log(`Video file saved to DB: ${newFile.fileName}`);
  } catch (error) {
    log(`Error processing video file ${fileName}: ${error.message}`);
  }
}

async function processImage(filePath, imageBuffer) {
  const fileName = path.basename(filePath);
  log(`Processing image file: ${fileName}`);

  const fileExtension = path.extname(filePath);
  const fileBaseName = path.basename(fileName, fileExtension);
  const targetFolderId = liveFolderId;

  // Create permanent storage folders
  const permanentFolderBase = path.join(
    __dirname,
    "..",
    "public",
    "images",
    String(targetFolderId)
  );
  const originalFolder = path.join(permanentFolderBase, "original");
  const webpFolder = path.join(permanentFolderBase, "webp");
  const thumbFolder = path.join(permanentFolderBase, "thumbs");

  try {
    await Promise.all([
      fs.mkdir(originalFolder, { recursive: true }),
      fs.mkdir(webpFolder, { recursive: true }),
      fs.mkdir(thumbFolder, { recursive: true }),
    ]);

    // Move original file to permanent folder
    const originalPath = path.join(originalFolder, fileName);
    await fs.rename(filePath, originalPath);
    log(`Moved original to: ${originalPath}`);

    // Read original again (in case of rename timing)
    const originalBuffer = await fs.readFile(originalPath);
    const fileStats = await fs.stat(originalPath);

    const hash = crypto.createHash("md5").update(originalBuffer).digest("hex");

    // Check for duplicates before heavy processing
    const existing = await prisma.file.findFirst({
      where: { hash: hash },
    });

    if (existing) {
      log(`Duplicate detected! Deleting ${fileName} and skipping.`);
      await fs.unlink(originalPath);
      return;
    }

    // Get original metadata including orientation, width, and height
    const originalSharp = sharp(originalBuffer);
    const originalMetadata = await originalSharp.metadata();
    const imageWidth = originalMetadata.width || null;
    const imageHeight = originalMetadata.height || null;
    const imageRotation = originalMetadata.orientation || 1; // Default to 1 (normal)

    // Create a sharp instance that applies rotation for variant generation
    const rotatedImageForVariants = originalSharp.rotate();
    const rotatedImageBuffer = await rotatedImageForVariants.toBuffer();

    // Create WebP and thumbnail variants
    const webpPath = path.join(webpFolder, `${fileBaseName}.webp`);
    const thumbPath = path.join(thumbFolder, `${fileBaseName}_thumb.webp`);

    await sharp(rotatedImageBuffer).webp({ quality: 80 }).toFile(webpPath);
    log(`Generated WebP: ${webpPath}`);

    await sharp(rotatedImageBuffer)
      .resize(200, 200, { fit: "cover" })
      .webp({ quality: 80 })
      .toFile(thumbPath);
    log(`Generated thumbnail: ${thumbPath}`);

    const [webpStats, thumbStats] = await Promise.all([
      fs.stat(webpPath),
      fs.stat(thumbPath),
    ]);

    // Save to DB
    const newFile = await prisma.file.create({
      data: {
        fileName,
        hash,
        width: imageWidth,
        height: imageHeight,
        rotation: imageRotation, // Store the EXIF orientation value
        fileSize: BigInt(fileStats.size),
        fileType: "image",
        folderId: targetFolderId,
        variants: {
          create: [
            {
              name: "original",
              path: path.relative(process.cwd(), originalPath),
              size: BigInt(fileStats.size),
            },
            {
              name: "webp",
              path: path.relative(process.cwd(), webpPath),
              size: BigInt(webpStats.size),
            },
            {
              name: "thumbnail",
              path: path.relative(process.cwd(), thumbPath),
              size: BigInt(thumbStats.size),
            },
          ],
        },
      },
    });

    log(`File and variants saved to DB: ${newFile.fileName}`);
  } catch (error) {
    log(`Error processing image file ${fileName}: ${error.message}`);
  }
}

async function startWatching() {
  try {
    await fs.mkdir(ingestFolder, { recursive: true });
    log(`Ready. Watching for new files in: ${ingestFolder}`);
  } catch (err) {
    console.error("Error creating ingest folder:", err);
    process.exit(1);
  }

  chokidar
    .watch(ingestFolder, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles and folders
      persistent: true,
      ignoreInitial: false,
      depth: 10, // watch up to 10 levels deep for subfolders
      awaitWriteFinish: {
        stabilityThreshold: 1500, // wait for 1.5 sec of no changes before triggering
        pollInterval: 100,
      },
    })
    .on("add", async (filePath) => {
      log(`Detected new file: ${filePath}`);
      enqueueFile(filePath);
    })
    .on("error", (error) => log(`Watcher error: ${error.message}`))
    .on("ready", () => log("Watcher is now active..."));
}

// Bootstrapping startup process
(async () => {
  await findOrCreateLiveFolder();
  await startWatching();
})();
