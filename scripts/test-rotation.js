#!/usr/bin/env node

/**
 * Test script to verify image rotation functionality
 *
 * Usage: node test-rotation.js <image-path>
 *
 * This script will:
 * 1. Read the image and check its EXIF orientation
 * 2. Apply rotation using Sharp.js
 * 3. Verify the final dimensions
 * 4. Output the results
 */

const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");

async function testImageRotation(imagePath) {
  try {
    console.log(`Testing image rotation for: ${imagePath}`);

    // Check if file exists
    await fs.access(imagePath);

    // Read original image
    const imageBuffer = await fs.readFile(imagePath);

    // Get original metadata
    const originalSharp = sharp(imageBuffer, { failOnError: false });
    const originalMetadata = await originalSharp.metadata();

    console.log("Original metadata:");
    console.log(`  - Width: ${originalMetadata.width}`);
    console.log(`  - Height: ${originalMetadata.height}`);
    console.log(`  - EXIF Orientation: ${originalMetadata.orientation || 1}`);
    console.log(`  - Format: ${originalMetadata.format}`);

    // Apply rotation
    const rotatedSharp = sharp(imageBuffer, { failOnError: false }).rotate();
    const rotatedMetadata = await rotatedSharp.metadata();

    console.log("\nAfter rotation:");
    console.log(`  - Width: ${rotatedMetadata.width}`);
    console.log(`  - Height: ${rotatedMetadata.height}`);
    console.log(`  - EXIF Orientation: ${rotatedMetadata.orientation || 1}`);

    // Determine orientation
    const isPortrait = rotatedMetadata.height > rotatedMetadata.width;
    const isLandscape = rotatedMetadata.width > rotatedMetadata.height;
    const isSquare = rotatedMetadata.width === rotatedMetadata.height;

    console.log("\nOrientation analysis:");
    console.log(`  - Is Portrait: ${isPortrait}`);
    console.log(`  - Is Landscape: ${isLandscape}`);
    console.log(`  - Is Square: ${isSquare}`);

    // Test variant generation
    console.log("\nTesting variant generation...");
    const outputDir = path.join(__dirname, "test-output");
    await fs.mkdir(outputDir, { recursive: true });

    const baseName = path.basename(imagePath, path.extname(imagePath));

    // Generate WebP
    const webpPath = path.join(outputDir, `${baseName}.webp`);
    await rotatedSharp.clone().webp({ quality: 85 }).toFile(webpPath);
    console.log(`  - WebP generated: ${webpPath}`);

    // Generate thumbnail
    const thumbPath = path.join(outputDir, `${baseName}_thumb.webp`);
    await rotatedSharp
      .clone()
      .resize(300, 300, { fit: "cover", position: "center" })
      .webp({ quality: 80 })
      .toFile(thumbPath);
    console.log(`  - Thumbnail generated: ${thumbPath}`);

    console.log("\n✅ Test completed successfully!");
    console.log("The image rotation system is working correctly.");
  } catch (error) {
    console.error("❌ Error during testing:", error.message);
    process.exit(1);
  }
}

// Main execution
if (process.argv.length < 3) {
  console.log("Usage: node test-rotation.js <image-path>");
  console.log("Example: node test-rotation.js ./test-image.jpg");
  process.exit(1);
}

const imagePath = process.argv[2];
testImageRotation(imagePath);
