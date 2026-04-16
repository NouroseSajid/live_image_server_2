const chokidar = require("chokidar");
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { PrismaClient } = require("@prisma/client");
const { fileTypeFromBuffer } = require("file-type");
const crypto = require("node:crypto");
const WebSocket = require("ws");
require("dotenv").config({ path: ".env.local" });

const prisma = new PrismaClient();
const ingestFolder = path.join(__dirname, "..", "image_repo", "ingest");
const failedFolder = path.join(__dirname, "..", "image_repo", "failed");
const failedLogPath = path.join(__dirname, "..", "failed-log.txt");
const configPath = path.join(__dirname, "..", "ingest-config.json");

// Get WebSocket configuration from environment
const WS_HOST = process.env.WS_SERVER_HOST || "localhost";
const WS_PORT = process.env.WS_SERVER_PORT || "8080";
const WS_URL = `ws://${WS_HOST}:${WS_PORT}`;

// --- Constants ---
const _VARIANT_NAMES = {
  ORIGINAL: "original",
  WEBP: "webp",
  THUMB: "thumb",
};
const _THUMB_SIZE = Number.parseInt(process.env.THUMB_WIDTH || "300", 10);
const _WEBP_QUALITY = Number.parseInt(process.env.WEBP_QUALITY || "80", 10);
const _WS_RECONNECT_DELAY = 5000;
const _CONFIG_UPDATE_INTERVAL = Number.parseInt(process.env.CONFIG_UPDATE_INTERVAL || "5000", 10);
const _FILE_STABLE_THRESHOLD = Number.parseInt(process.env.FILE_STABLE_THRESHOLD || "1500", 10);
const _VIDEO_PLACEHOLDER = "/icons/video-placeholder.svg";
const _VIDEO_FALLBACK_WIDTH = 1920;
const _VIDEO_FALLBACK_HEIGHT = 1080;

let liveFolderId = null;
let ws;
let watcher = null;

// Track retries to avoid infinite loops
const retryCount = new Map();

// Graceful shutdown
async function shutdown() {
  log("Shutting down gracefully...");
  if (watcher) watcher.close();
  if (ws) ws.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Simple logger used across this script
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function logFailed(fileName, error) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${fileName}: ${error}\n`;
  try {
    await fs.appendFile(failedLogPath, entry);
  } catch (err) {
    console.error("Failed to write to failure log:", err);
  }
}

// Simple processing queue controls
const processingQueue = [];
const MAX_WORKERS = Number.parseInt(process.env.INGEST_WORKERS || "4", 10);
let activeWorkers = 0;

// --- WebSocket Client Setup ---
function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    log(`[WS] Connected to WebSocket server at ${WS_URL}`);
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

async function getIngestFolderId() {
  try {
    const data = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(data);
    if (config.folderId) return config.folderId;
    if (Array.isArray(config.folderIds) && config.folderIds.length > 0) return config.folderIds[0];
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Error reading ingest-config.json:", error);
    return null;
  }
}

async function updateIngestFolderId() {
  try {
    const folderId = await getIngestFolderId();
    if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (folder) {
        if (liveFolderId !== folder.id) {
          log(`Ingest folder changed to: ${folder.name} (ID: ${folder.id})`);
          liveFolderId = folder.id;
        }
        return;
      }
      log(`Warning: Folder ID ${folderId} not found. Ingest paused.`);
      liveFolderId = null;
      return;
    }
    if (liveFolderId !== null) {
      log("No ingest folder selected. Ingest paused.");
      liveFolderId = null;
    }
  } catch (error) {
    console.error("Error while updating ingest folder:", error);
  }
}

// Enqueue file paths to process one by one
function runNext() {
  if (activeWorkers === 0 && processingQueue.length === 0) {
    checkAndRetryFailed();
  }

  while (activeWorkers < MAX_WORKERS && processingQueue.length > 0) {
    const nextFile = processingQueue.shift();
    if (!nextFile) break;
    activeWorkers += 1;
    processFile(nextFile)
      .catch((error) => {
        log(`Error processing file in queue: ${error.message}`);
      })
      .finally(() => {
        activeWorkers -= 1;
        runNext();
      });
  }
}

async function checkAndRetryFailed() {
  try {
    const files = await fs.readdir(failedFolder);
    for (const file of files) {
      const fullPath = path.join(failedFolder, file);
      const count = retryCount.get(file) || 0;
      if (count < 1) { 
        log(`Retrying failed file: ${file}`);
        retryCount.set(file, count + 1);
        enqueueFile(fullPath);
      }
    }
  } catch (err) {
    // Ignore
  }
}

async function enqueueFile(filePath) {
  processingQueue.push(filePath);
  runNext();
}

async function handleFailure(filePath, error) {
  const fileName = path.basename(filePath);
  log(`FAILURE for ${fileName}: ${error}`);
  await logFailed(fileName, error);
  
  try {
    await fs.mkdir(failedFolder, { recursive: true });
    const destPath = path.join(failedFolder, fileName);
    if (filePath !== destPath) {
        await fs.rename(filePath, destPath);
        log(`Moved failed file to: ${destPath}`);
    }
  } catch (err) {
    log(`Critical error: Could not move failed file ${fileName}: ${err.message}`);
  }
}

async function processFile(filePath) {
  const currentPath = filePath;
  try {
    if (!liveFolderId) {
      log(`Ingest paused (no folder selected). Leaving file: ${filePath}`);
      return;
    }

    await fs.access(filePath);
    const fileBuffer = await fs.readFile(filePath);
    const fileTypeResult = await fileTypeFromBuffer(fileBuffer);
    const isRaw = isRawFile(filePath);

    if (!fileTypeResult && !isRaw) {
      log(`Skipping unsupported file (unknown type): ${filePath}`);
      await fs.unlink(filePath);
      return;
    }

    const mime = fileTypeResult ? fileTypeResult.mime : "application/octet-stream";
    const isImage = mime.startsWith("image/");
    const isVideo = mime.startsWith("video/");

    if (isRaw) {
      await processRawFile(filePath);
    } else if (isVideo) {
      await processVideo(filePath, fileTypeResult);
    } else if (isImage) {
      await processImage(filePath, fileBuffer);
    } else {
      log(`Skipping unsupported file: ${filePath}`);
      await fs.unlink(filePath);
    }
  } catch (error) {
    await handleFailure(currentPath, error.message);
  }
}

function isRawFile(filePath) {
  const rawExtensions = [".arw", ".cr2", ".cr3", ".nef", ".orf", ".raf", ".rw2", ".pef", ".dng"];
  return rawExtensions.includes(path.extname(filePath).toLowerCase());
}

async function processRawFile(filePath) {
  const fileName = path.basename(filePath);
  const targetFolderId = liveFolderId;
  const rawFolder = path.join(__dirname, "..", "image_repo", "images", String(targetFolderId), "raw");

  await fs.mkdir(rawFolder, { recursive: true });
  const originalPath = path.join(rawFolder, fileName);
  await fs.rename(filePath, originalPath);
  log(`Moved RAW file to: ${originalPath}`);
}

async function processVideo(filePath, fileTypeResult) {
  const fileName = path.basename(filePath);
  const targetFolderId = liveFolderId;
  const originalFolder = path.join(__dirname, "..", "image_repo", "images", String(targetFolderId), "original");
  
  await fs.mkdir(originalFolder, { recursive: true });
  const originalPath = path.join(originalFolder, fileName);

  const videoBuffer = await fs.readFile(filePath);
  const hash = crypto.createHash("md5").update(videoBuffer).digest("hex");

  const existing = await prisma.file.findFirst({ where: { hash } });
  if (existing) {
    log(`Duplicate video detected! Deleting ${fileName}.`);
    await fs.unlink(filePath);
    return;
  }

  await fs.rename(filePath, originalPath);

  try {
    const fileStats = await fs.stat(originalPath);
    const newFile = await prisma.file.create({
      data: {
        fileName, hash, mimeType: fileTypeResult?.mime || null,
        width: _VIDEO_FALLBACK_WIDTH, height: _VIDEO_FALLBACK_HEIGHT,
        fileSize: BigInt(fileStats.size), fileType: "video", folderId: targetFolderId,
        variants: {
          create: [
            { name: "original", path: `/images/${targetFolderId}/original/${fileName}`, size: BigInt(fileStats.size) },
            { name: "thumbnail", path: _VIDEO_PLACEHOLDER, size: BigInt(0) },
          ],
        },
      },
      include: { variants: true },
    });
    log(`Video file saved to DB: ${newFile.fileName}`);
    broadcastNewFile(newFile);
  } catch (dbError) {
    await handleFailure(originalPath, dbError.message);
  }
}

async function processImage(filePath, fileBuffer) {
  const fileName = path.basename(filePath);
  const fileExtension = path.extname(filePath);
  const fileBaseName = path.basename(fileName, fileExtension);
  const targetFolderId = liveFolderId;

  const baseFolder = path.join(__dirname, "..", "image_repo", "images", String(targetFolderId));
  const originalFolder = path.join(baseFolder, "original");
  const webpFolder = path.join(baseFolder, "webp");
  const thumbFolder = path.join(baseFolder, "thumbs");

  await Promise.all([
    fs.mkdir(originalFolder, { recursive: true }),
    fs.mkdir(webpFolder, { recursive: true }),
    fs.mkdir(thumbFolder, { recursive: true }),
  ]);

  const hash = crypto.createHash("md5").update(fileBuffer).digest("hex");
  const existing = await prisma.file.findFirst({ where: { hash } });
  if (existing) {
    log(`Duplicate detected! Deleting ${fileName}.`);
    await fs.unlink(filePath);
    return;
  }

  const originalPath = path.join(originalFolder, fileName);
  const webpPath = path.join(webpFolder, `${fileBaseName}.webp`);
  const thumbPath = path.join(thumbFolder, `${fileBaseName}_thumb.webp`);

  const rotatedSharp = sharp(fileBuffer, { failOnError: false }).rotate();
  const meta = await rotatedSharp.metadata();

  await rotatedSharp.clone().webp({ quality: 75, effort: 6 }).toFile(webpPath);
  await rotatedSharp.clone().resize(300, 300, { fit: "cover" }).webp({ quality: 80 }).toFile(thumbPath);

  await fs.rename(filePath, originalPath);

  try {
    const [origStats, webpStats, thumbStats] = await Promise.all([
      fs.stat(originalPath), fs.stat(webpPath), fs.stat(thumbPath)
    ]);

    const newFile = await prisma.file.create({
      data: {
        fileName, hash, mimeType: "image/webp",
        width: meta.width, height: meta.height,
        fileSize: BigInt(origStats.size), fileType: "image", folderId: targetFolderId,
        variants: {
          create: [
            { name: "original", path: `/images/${targetFolderId}/original/${fileName}`, size: BigInt(origStats.size) },
            { name: "webp", path: `/images/${targetFolderId}/webp/${fileBaseName}.webp`, size: BigInt(webpStats.size) },
            { name: "thumbnail", path: `/images/${targetFolderId}/thumbs/${fileBaseName}_thumb.webp`, size: BigInt(thumbStats.size) },
          ],
        },
      },
      include: { variants: true },
    });

    log(`Image saved: ${newFile.fileName}`);
    broadcastNewFile(newFile);
  } catch (dbError) {
    await handleFailure(originalPath, dbError.message);
  }
}

async function startWatching() {
  try {
    await fs.mkdir(ingestFolder, { recursive: true });
    await fs.mkdir(failedFolder, { recursive: true });
    log(`Ready. Watching: ${ingestFolder}`);
  } catch (err) {
    console.error("Error creating folders:", err);
    return;
  }

  watcher = chokidar.watch(ingestFolder, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 100 },
  })
  .on("add", (path) => enqueueFile(path))
  .on("error", (error) => log(`Watcher error: ${error.message}`));
}

(async () => {
  connectWebSocket();
  await updateIngestFolderId();
  setInterval(updateIngestFolderId, 5000);
  await startWatching();
})();
