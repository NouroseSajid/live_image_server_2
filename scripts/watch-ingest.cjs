const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const { fileTypeFromBuffer } = require('file-type');
const crypto = require('crypto');

const prisma = new PrismaClient();
const ingestFolder = path.join(process.cwd(), 'public', 'ingest');

async function ensureDefaultFolderExists() {
  const targetFolderId = 'clvj1s5s0000008l0g1g2h3j4'; // A fixed, unique ID for the default folder
  try {
    let folder = await prisma.folder.findUnique({
      where: { id: targetFolderId },
    });

    if (!folder) {
      console.log(`Default folder not found. Creating it now...`);
      folder = await prisma.folder.create({
        data: {
          id: targetFolderId,
          name: 'Default Ingest Folder',
          uniqueUrl: `default-ingest-${crypto.randomBytes(4).toString('hex')}`,
          // Add any other required fields with default values
        },
      });
      console.log(`Default folder created with ID: ${folder.id}`);
    }
  } catch (error) {
    console.error('Error ensuring default folder exists:', error);
    process.exit(1); // Exit if we can't ensure the folder exists
  }
}

ensureDefaultFolderExists();

// Ensure the ingest folder exists
if (!fs.existsSync(ingestFolder)) {
  fs.mkdirSync(ingestFolder, { recursive: true });
  console.log(`Created ingest folder: ${ingestFolder}`);
}

console.log(`Watching for new images in: ${ingestFolder}`);

chokidar.watch(ingestFolder, {
  ignored: /(^|[\/\\])\..*/, // ignore dotfiles
  persistent: true,
  ignoreInitial: true, // Don't emit add events for files that already exist when the watcher starts
}).on('add', async (filePath) => {
  console.log(`New image detected: ${filePath}`);

  const fileName = path.basename(filePath);
  const fileExtension = path.extname(filePath);
  const fileBaseName = path.basename(fileName, fileExtension);

  // TODO: Implement a mechanism to get the default ingest folder ID from the database or configuration.
  // For now, using a placeholder. This should be configurable in the admin panel.
  const targetFolderId = 'clvj123450000000000000000'; // Replace with a valid folder ID from your DB

  try {
    const folder = await prisma.folder.findUnique({
      where: { id: targetFolderId },
    });

    if (!folder) {
      console.error(`Default ingest folder with ID ${targetFolderId} not found in database. Skipping image processing for ${fileName}.`);
      return;
    }

    // Create permanent storage folders
    const permanentFolderBase = path.join(process.cwd(), 'public', 'images', targetFolderId);
    const originalFolder = path.join(permanentFolderBase, 'original');
    const webpFolder = path.join(permanentFolderBase, 'webp');
    const thumbFolder = path.join(permanentFolderBase, 'thumbs');

    await fs.promises.mkdir(originalFolder, { recursive: true });
    await fs.promises.mkdir(webpFolder, { recursive: true });
    await fs.promises.mkdir(thumbFolder, { recursive: true });

    // Move original file to permanent location
    const originalPath = path.join(originalFolder, fileName);
    await fs.promises.rename(filePath, originalPath);
    console.log(`Moved original to: ${originalPath}`);

    const imageBuffer = fs.readFileSync(originalPath);
    const fileStats = fs.statSync(originalPath);

    // Simple hash generation (for demonstration, consider a more robust hashing like BLAKE3)
    const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');

    const fileTypeResult = await fileTypeFromBuffer(imageBuffer);
    let fileType = 'image'; // Default to image
    if (fileTypeResult && fileTypeResult.mime.startsWith('video')) {
      fileType = 'video';
    }

    let imageWidth = null;
    let imageHeight = null;
    let rotatedImageBuffer = imageBuffer;

    if (fileType === 'image') {
      const rotatedImage = sharp(imageBuffer).rotate();
      const metadata = await rotatedImage.metadata();
      imageWidth = metadata.width || null;
      imageHeight = metadata.height || null;
      rotatedImageBuffer = await rotatedImage.toBuffer();

      // Generate WebP for lightbox (ensure correct orientation)
      const webpPath = path.join(webpFolder, `${fileBaseName}.webp`);
      await sharp(rotatedImageBuffer)
        .webp({ quality: 80 })
        .toFile(webpPath);
      console.log(`Generated WebP: ${webpPath}`);

      // Generate thumbnail (higher quality to reduce visible artifacts)
      const thumbPath = path.join(thumbFolder, `${fileBaseName}_thumb.webp`);
      await sharp(webpPath)
        .resize(200, 200, { fit: 'cover' })
        .webp({ quality: 80, reductionEffort: 4 })
        .toFile(thumbPath);
      console.log(`Generated thumbnail from webp: ${thumbPath}`);
    }

    const webpPath = path.join(webpFolder, `${fileBaseName}.webp`);
    const thumbPath = path.join(thumbFolder, `${fileBaseName}_thumb.webp`);
    const webpStats = fs.existsSync(webpPath) ? fs.statSync(webpPath) : null;
    const thumbStats = fs.existsSync(thumbPath) ? fs.statSync(thumbPath) : null;

    // Store in database
    const newFile = await prisma.file.create({
      data: {
        fileName: fileName,
        hash: hash,
        width: imageWidth,
        height: imageHeight,
        rotation: 0, // Set rotation to 0 as the image is physically rotated
        fileSize: BigInt(fileStats.size),
        fileType: fileType,
        folderId: targetFolderId,
        variants: {
          create: [
            { name: 'original', path: originalPath, size: BigInt(fileStats.size) },
            ...(webpStats ? [{ name: 'webp', path: webpPath, size: BigInt(webpStats.size) }] : []),
            ...(thumbStats ? [{ name: 'thumbnail', path: thumbPath, size: BigInt(thumbStats.size) }] : []),
          ],
        },
      },
    });
    console.log(`File and variants saved to DB: ${newFile.fileName}`);

  } catch (error) {
    console.error(`Error processing image ${fileName}:`, error);
  }
});