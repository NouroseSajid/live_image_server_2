const chokidar = require("chokidar");
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { PrismaClient } = require("@prisma/client");
const { fileTypeFromBuffer } = require("file-type");
const crypto = require("node:crypto");
const WebSocket = require("ws");

const prisma = new PrismaClient();
const ingestFolder = path.join(__dirname, "..", "public", "ingest");
const configPath = path.join(__dirname, "..", "ingest-config.json");

let liveFolderId = null;
let ws;

// Simple logger used across this script
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Simple processing queue controls
const processingQueue = [];
let processing = false;

// --- WebSocket Client Setup ---
function connectWebSocket() {
  ws = new WebSocket("ws://localhost:8080");

  ws.on("open", () => {
    log("[WS] Connected to WebSocket server");
  });

  ws.on("error", (error) => {
    log(`[WS] Connection error: ${error.message}`);
  });

  ws.on("close", () => {
    log("[WS] Disconnected. Attempting to reconnect in 5 seconds...");
    setTimeout(connectWebSocket, 5000);
  });
}

function broadcastNewFile(file) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Serialize BigInt properties (Prisma uses BigInt for sizes) to strings
    const serialize = (obj) => {
      if (!obj || typeof obj !== "object") return obj;
      const out = Array.isArray(obj) ? [] : {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "bigint") {
          out[k] = v.toString();
        } else if (Array.isArray(v)) {
          out[k] = v.map((item) => serialize(item));
        } else if (v && typeof v === "object") {
          out[k] = serialize(v);
        } else {
          out[k] = v;
        }
      }
      return out;
    };

    const payload = serialize(file);
    const message = JSON.stringify({ type: "new-file", payload });
    ws.send(message);
    log(`[WS] Broadcasted new file: ${file.fileName}`);
  } else {
    log("[WS] Cannot broadcast: WebSocket is not open.");
  }
}

// --- End WebSocket Client Setup ---

async function getIngestFolderId() {
  try {
    const data = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(data);
    // Handle legacy single-folder shape or new array shape
    if (config.folderId) {
      return config.folderId;
    }
    if (Array.isArray(config.folderIds) && config.folderIds.length > 0) {
      // Normalize to first configured folder for the live watcher
      return config.folderIds[0];
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Error reading ingest-config.json:", error);
    }
    return null;
  }
}

async function updateIngestFolderId() {
  try {
    const folderId = await getIngestFolderId();

    // If a folderId is configured, prefer and use that (validate it exists)
    if (folderId) {
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      });
      if (folder) {
        if (liveFolderId !== folder.id) {
          log(`Ingest folder changed to: ${folder.name} (ID: ${folder.id})`);
          liveFolderId = folder.id;
        }
        return;
      }
      // Config pointed to a non-existent folder; warn but continue to ensure a LIVE folder exists
      log(`Warning: Folder ID ${folderId} from config not found in database.`);
    }

    // Only search/create a default LIVE folder if we don't already have one configured/known
    if (liveFolderId) {
      // Already have a live folder set; nothing to do
      return;
    }

    log("Checking for existing LIVE folder...");
    let folder = await prisma.folder.findFirst({
      where: { name: { contains: "live" } },
      orderBy: { createdAt: "desc" },
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
    return;
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
    const isRaw = isRawFile(filePath);

    if (!fileTypeResult && !isRaw) {
      log(`Skipping unsupported file (unknown type): ${filePath}`);
      await fs.unlink(filePath);
      return;
    }

    const mime = fileTypeResult
      ? fileTypeResult.mime
      : "application/octet-stream";
    const isImage = mime.startsWith("image/");
    const isVideo = mime.startsWith("video/");

    if (isRaw) {
      await processRawFile(filePath);
    } else if (isVideo) {
      await processVideo(filePath, fileTypeResult);
    } else if (isImage) {
      await processImage(filePath, fileBuffer);
    } else {
      log(`Skipping unsupported file (not image, video, or raw): ${filePath}`);
      await fs.unlink(filePath);
    }
  } catch (error) {
    log(`Error processing file ${filePath}: ${error.message}`);
  }
}

function isRawFile(filePath) {
  const rawExtensions = [
    ".arw",
    ".cr2",
    ".cr3",
    ".nef",
    ".orf",
    ".raf",
    ".rw2",
    ".pef",
    ".dng",
  ];
  const extension = path.extname(filePath).toLowerCase();
  return rawExtensions.includes(extension);
}

async function processRawFile(filePath) {
  const fileName = path.basename(filePath);
  log(`Processing RAW file: ${fileName}`);
  const targetFolderId = liveFolderId;
  const permanentFolderBase = path.join(
    __dirname,
    "..",
    "public",
    "images",
    String(targetFolderId),
  );
  const rawFolder = path.join(permanentFolderBase, "raw");

  try {
    await fs.mkdir(rawFolder, { recursive: true });
    const originalPath = path.join(rawFolder, fileName);
    await fs.rename(filePath, originalPath);
    log(`Moved RAW file to: ${originalPath}`);
  } catch (error) {
    log(`Error moving RAW file ${fileName}: ${error.message}`);
  }
}

async function processVideo(filePath, fileTypeResult) {
  const fileName = path.basename(filePath);
  log(`Processing video file: ${fileName}`);
  const targetFolderId = liveFolderId;

  // Create permanent storage folders
  const permanentFolderBase = path.join(
    __dirname,
    "..",
    "public",
    "images",
    String(targetFolderId),
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

    const existing = await prisma.file.findFirst({ where: { hash } });
    if (existing) {
      log(`Duplicate video detected! Deleting ${fileName} and skipping.`);
      await fs.unlink(originalPath);
      return;
    }

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
              path: "/images/" + targetFolderId + "/original/" + fileName.replace(/\\/g, "/"),
              size: BigInt(fileStats.size),
            },
          ],
        },
      },
      include: { variants: true },
    });

    log(`Video file saved to DB: ${newFile.fileName}`);
    broadcastNewFile(newFile);
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
    String(targetFolderId),
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

    const existing = await prisma.file.findFirst({
      where: { hash: hash },
    });

    if (existing) {
      log(`Duplicate detected! Deleting ${fileName} and skipping.`);
      await fs.unlink(originalPath);
      return;
    }

    // PROPER ROTATION HANDLING - FIXED VERSION
    // First, get the original metadata to check EXIF orientation
    const originalSharp = sharp(originalBuffer, { failOnError: false });
    const originalMetadata = await originalSharp.metadata();
    const originalOrientation = originalMetadata.orientation || 1;

    log(`Original orientation for ${fileName}: ${originalOrientation}`);

    // Auto-rotate according to EXIF orientation, producing an upright image
    // This physically rotates the image pixels
    const rotatedSharp = sharp(originalBuffer, { failOnError: false }).rotate();
    const rotatedMetadata = await rotatedSharp.metadata();

    // Get the final dimensions after rotation
    let imageWidth = rotatedMetadata.width || null;
    let imageHeight = rotatedMetadata.height || null;

    // After applying rotate(), set orientation to normal for stored variants
    const imageRotation = 1; // Always 1 after physically rotating

    log(`Dimensions after rotation: ${imageWidth}x${imageHeight}`);

    // Determine if image should be landscape or portrait based on final dimensions
    if (imageWidth && imageHeight) {
      const isPortrait = imageHeight > imageWidth;
      log(`Image orientation: ${isPortrait ? "Portrait" : "Landscape"}`);
    }

    // Use rotatedSharp as the source for variant generation
    const sharpForVariants = rotatedSharp.withMetadata({
      orientation: imageRotation,
    });

    // Create WebP and thumbnail variants
    const webpPath = path.join(webpFolder, `${fileBaseName}.webp`);
    const thumbPath = path.join(thumbFolder, `${fileBaseName}_thumb.webp`);

    // Generate variants with proper quality settings
    // Quality 75 targets ~1-2MB file size (WhatsApp-like compression)
    await sharpForVariants
      .clone()
      .webp({ quality: 75, effort: 6 })
      .toFile(webpPath);
    log(`Generated WebP: ${webpPath}`);

    await sharpForVariants
      .clone()
      .resize(300, 300, {
        fit: "cover",
        position: "center",
        withoutEnlargement: false,
      })
      .webp({ quality: 80, effort: 6 })
      .toFile(thumbPath);
    log(`Generated thumbnail: ${thumbPath}`);

    const [webpStats, thumbStats] = await Promise.all([
      fs.stat(webpPath),
      fs.stat(thumbPath),
    ]);

    const folderExists = await prisma.folder.findUnique({
      where: { id: targetFolderId },
    });
    if (!folderExists) {
      log(
        `Error: Folder with ID ${targetFolderId} does not exist. Cannot create file.`,
      );
      return;
    }

    const newFile = await prisma.file.create({
      data: {
        fileName,
        hash,
        width: imageWidth,
        height: imageHeight,
        rotation: imageRotation,
        fileSize: BigInt(fileStats.size),
        fileType: "image",
        folderId: targetFolderId,
        variants: {
          create: [
            {
              name: "original",
              path: "/images/" + targetFolderId + "/original/" + fileName.replace(/\\/g, "/"),
              size: BigInt(fileStats.size),
            },
            {
              name: "webp",
              path: "/images/" + targetFolderId + "/webp/" + `${fileBaseName}.webp`.replace(/\\/g, "/"),
              size: BigInt(webpStats.size),
            },
            {
              name: "thumbnail",
              path: "/images/" + targetFolderId + "/thumbs/" + `${fileBaseName}_thumb.webp`.replace(/\\/g, "/"),
              size: BigInt(thumbStats.size),
            },
          ],
        },
      },
      include: { variants: true },
    });

    log(
      `File and variants saved to DB: ${newFile.fileName} (${imageWidth}x${imageHeight})`,
    );
    broadcastNewFile(newFile);
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
    return;
  }

  chokidar
    .watch(ingestFolder, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: false,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 1500,
        pollInterval: 100,
      },
    })
    .on("add", (filePath) => {
      log(`Detected new file: ${filePath}`);
      enqueueFile(filePath);
    })
    .on("error", (error) => log(`Watcher error: ${error.message}`))
    .on("ready", () => log("Watcher is now active..."));
}

// Bootstrapping startup process
(async () => {
  connectWebSocket();
  await updateIngestFolderId();
  setInterval(updateIngestFolderId, 5000);
  await startWatching();
})();
