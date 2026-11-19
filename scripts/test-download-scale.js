#!/usr/bin/env node
/**
 * Scale test for the ZIP download pipeline.
 *
 * Unlike scripts/test-downloads.js (which uses a single image), this selects
 * many real files, creates one download session, and streams the whole ZIP
 * back without buffering it in Node. That is what actually reproduces the
 * reported "large / multi-file downloads fail" symptom.
 *
 * Usage (all env vars optional):
 *   TEST_IMAGE_COUNT=25 TEST_QUALITY=original node scripts/test-download-scale.js
 *   TEST_IMAGE_COUNT=100 TEST_QUALITY=webp TEST_TIMEOUT_MS=900000 node scripts/test-download-scale.js
 *   TEST_FOLDER_ID=<id> TEST_BASE_URL=http://192.168.1.111:3000 node scripts/test-download-scale.js
 *
 * Requirements: running server, reachable DATABASE_URL, STORAGE_ROOT set.
 */
require("dotenv").config();

const { access } = require("node:fs/promises");
const { join, resolve } = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const BASE_URL = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const COUNT = Number(process.env.TEST_IMAGE_COUNT || 10);
const QUALITY = process.env.TEST_QUALITY || "original";
const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS || 15 * 60 * 1000);
const FOLDER_ID = process.env.TEST_FOLDER_ID || null;

if (!process.env.STORAGE_ROOT) {
  throw new Error("STORAGE_ROOT is not set (needed to locate image files)");
}
const STORAGE_ROOT = resolve(process.env.STORAGE_ROOT);

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const formatBytes = (n) => {
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(2)} ${units[i]}`;
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  [PASS] ${message}`);
}

const dbPathToAbsolute = (p) => join(STORAGE_ROOT, String(p).replace(/^\/+/, ""));
const exists = async (p) => access(p).then(() => true, () => false);

// ZIP signatures. A 3-byte carry handles signatures split across chunk boundaries.
const LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const CENTRAL_HEADER = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
const EOCD = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

function countOccurrences(haystack, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) !== -1) {
    count++;
    offset += needle.length;
  }
  return count;
}

async function selectFiles() {
  const files = await prisma.file.findMany({
    where: {
      deletedAt: null,
      folder: { is: { isPrivate: false } },
      ...(FOLDER_ID ? { folderId: FOLDER_ID } : {}),
    },
    include: { variants: { select: { name: true, path: true, size: true } } },
    orderBy: { createdAt: "desc" },
    take: COUNT * 4, // leave room for variants missing on disk
  });

  const selected = [];
  for (const file of files) {
    if (selected.length >= COUNT) break;
    const variant =
      file.variants.find((v) => v.name === QUALITY) ||
      file.variants.find((v) => v.name === "original") ||
      file.variants[0];
    if (!variant || !(await exists(dbPathToAbsolute(variant.path)))) continue;
    selected.push({ id: file.id, name: file.fileName, size: Number(variant.size) || 0 });
  }
  return selected;
}

async function main() {
  console.log(`Scale download test against ${BASE_URL}`);
  console.log(`  count=${COUNT}  quality=${QUALITY}  timeout=${TIMEOUT_MS / 1000}s`);
  console.log("");

  const files = await selectFiles();
  assert(files.length === COUNT, `selected ${COUNT} files with bytes on disk (got ${files.length})`);

  const expectedBytes = files.reduce((sum, f) => sum + f.size, 0);
  console.log(`  total source size: ${formatBytes(expectedBytes)}`);
  console.log(`  sample: ${files.slice(0, 3).map((f) => f.name).join(", ")}`);
  console.log("");

  console.log("[1] Create download session");
  const downloadId = `scale-test-${Date.now()}`;
  const createRes = await fetch(`${BASE_URL}/api/images/download-zip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageIds: files.map((f) => f.id),
      quality: QUALITY,
      downloadId,
      passphrase: "",
    }),
  });
  const createBody = await createRes.text();
  assert(createRes.status === 200, `POST download-zip returned 200 (got ${createRes.status}: ${createBody.slice(0, 200)})`);
  const session = JSON.parse(createBody);
  assert(typeof session.sessionToken === "string", "sessionToken returned");
  assert(session.totalFiles === COUNT, `totalFiles is ${COUNT} (got ${session.totalFiles})`);

  console.log("");
  console.log("[2] Stream ZIP (no full buffering)");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/images/download-zip/${session.sessionToken}`, {
      signal: controller.signal,
    });
    assert(res.status === 200, `ZIP stream returned 200 (got ${res.status})`);
    assert((res.headers.get("content-type") || "").includes("application/zip"), "content-type is application/zip");

    const reader = res.body.getReader();
    let totalBytes = 0;
    let localHeaders = 0;
    let centralHeaders = 0;
    let carry = Buffer.alloc(0);
    let lastBytes = Buffer.alloc(0);
    const firstBytes = Buffer.alloc(4);
    let firstFilled = 0;
    let nextReport = 25 * 1024 * 1024;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = Buffer.from(value);
      totalBytes += chunk.length;

      if (firstFilled < 4) {
        const take = Math.min(4 - firstFilled, chunk.length);
        chunk.copy(firstBytes, firstFilled, 0, take);
        firstFilled += take;
      }

      const data = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      localHeaders += countOccurrences(data, LOCAL_HEADER);
      centralHeaders += countOccurrences(data, CENTRAL_HEADER);
      carry = data.subarray(Math.max(0, data.length - 3));
      lastBytes = data.subarray(Math.max(0, data.length - 64));

      if (totalBytes >= nextReport) {
        console.log(`      streamed ${formatBytes(totalBytes)}...`);
        nextReport += 25 * 1024 * 1024;
      }
    }

    clearTimeout(timer);
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`      finished ${formatBytes(totalBytes)} in ${elapsed}s`);

    assert(firstBytes.subarray(0, 2).toString("ascii") === "PK", "ZIP has valid PK magic bytes");
    assert(totalBytes > 22, `ZIP is non-empty (${formatBytes(totalBytes)})`);
    assert(lastBytes.includes(EOCD), "ZIP has an end-of-central-directory record");
    assert(
      centralHeaders >= COUNT,
      `central directory lists at least ${COUNT} entries (found ${centralHeaders})`,
    );
    assert(localHeaders >= COUNT, `at least ${COUNT} local file headers (found ${localHeaders})`);
    console.log("");
    console.log(`PASS - ${COUNT} files, ${formatBytes(expectedBytes)} source -> ${formatBytes(totalBytes)} ZIP in ${elapsed}s`);
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") throw new Error(`stream timed out after ${TIMEOUT_MS / 1000}s`);
    throw err;
  } finally {
    // Poll once: the server deletes the session when streaming completes.
    await sleep(500);
  }
}

main()
  .catch((err) => {
    console.error(`\nFAIL: ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const del = await prisma.downloadSession.deleteMany({
        where: { downloadId: { startsWith: "scale-test-" } },
      });
      console.log(`Cleaned up ${del.count} scale-test session(s).`);
    } catch (err) {
      console.warn(`Warning: cleanup failed: ${err.message}`);
    }
    await prisma.$disconnect();
  });
