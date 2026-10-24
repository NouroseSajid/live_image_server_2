#!/usr/bin/env node
/**
 * Integration test for the image download flows.
 *
 * Verifies against a running Next.js server:
 *   1. Single-image download (the endpoint the lightbox uses)
 *   2. Multi-select ZIP download (the endpoint the grid/preview selection uses)
 *   3. Session lifecycle (POST create -> status polling -> GET zip -> cleanup)
 *   4. Validation & auth error paths
 *
 * Requirements:
 *   - The app must be running (default: http://localhost:3000)
 *   - A reachable DATABASE_URL in .env (to pick a real public image)
 *
 * Usage:
 *   npm run test:downloads
 *   TEST_BASE_URL=http://192.168.1.111:3000 npm run test:downloads
 *
 * Exit code 0 = all checks passed, 1 = at least one check failed.
 */

require("dotenv").config();

const { access } = require("node:fs/promises");
const { join } = require("node:path");
const { PrismaClient } = require("@prisma/client");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const IMAGE_REPO_ROOT = join(process.cwd(), "image_repo");

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, extra = "") {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    failed++;
    failures.push(name + (extra ? ` -- ${extra}` : ""));
    console.log(`  [FAIL] ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

async function request(path, options = {}) {
  const res = await fetch(BASE_URL + path, options);
  const body = Buffer.from(await res.arrayBuffer());
  return { res, body, status: res.status };
}

const dbPathToAbsolute = (dbPath) =>
  join(IMAGE_REPO_ROOT, String(dbPath).replace(/^\/+/, ""));

const fileExists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

async function main() {
  console.log(`Download flow tests against ${BASE_URL}`);
  console.log("");

  // --- Preflight: is the server up? ---
  try {
    const { status } = await request("/api/config");
    check("server is reachable", status === 200, `got ${status}`);
  } catch (err) {
    check("server is reachable", false, err.message);
    console.error("");
    console.error(
      "Cannot reach " +
        BASE_URL +
        ". Start the app first (npm run dev) and retry.",
    );
    process.exit(1);
  }

  // --- Pick a real public image from the DB ---
  let file = null;
  try {
    file = await prisma.file.findFirst({
      where: {
        deletedAt: null,
        folder: { is: { isPrivate: false } },
      },
      include: { variants: { select: { name: true, path: true, size: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    check("database is reachable", false, err.message);
  }
  check("found a public image in the database", !!file);
  if (!file) {
    console.log("");
    console.log("Skipping file-dependent checks (no public image in DB).");
    return;
  }

  const originalVariant =
    file.variants.find((v) => v.name === "original") || file.variants[0];
  const originalPath = dbPathToAbsolute(originalVariant.path);
  const originalOnDisk = await fileExists(originalPath);
  console.log("");
  console.log(`Image: ${file.fileName} (${file.id})`);
  console.log(
    "Variant on disk: " +
      (originalOnDisk ? "present" : "MISSING") +
      " -- " +
      originalPath,
  );
  console.log("");

  // --- 1. Single-image download (lightbox path) ---
  console.log("[1] Single-image download (/api/images/:id/download)");
  {
    const { status, body, res } = await request(
      `/api/images/${file.id}/download?quality=original`,
    );
    if (originalOnDisk) {
      check("single download returns 200", status === 200, `got ${status}`);
      check(
        "single download sets Content-Disposition: attachment",
        (res.headers.get("content-disposition") || "").includes("attachment"),
        res.headers.get("content-disposition") || "missing",
      );
      check("single download body is non-empty", body.length > 0);
    } else {
      // File bytes missing on disk -> the endpoint must say so, not hang.
      check(
        "single download returns 404 when file is missing on disk",
        status === 404,
        `got ${status}`,
      );
    }
  }

  // --- 2. Validation paths ---
  console.log("");
  console.log("[2] Validation paths (POST /api/images/download-zip)");
  {
    const { status } = await request("/api/images/download-zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: [], quality: "webp" }),
    });
    check("empty selection returns 400", status === 400, `got ${status}`);

    const { status: s2 } = await request("/api/images/download-zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: ["does-not-exist"], quality: "webp" }),
    });
    check("unknown image id returns 404", s2 === 404, `got ${s2}`);
  }

  // --- 3. Multi-select ZIP session lifecycle ---
  console.log("");
  console.log("[3] Multi-select ZIP download (/api/images/download-zip)");
  const sessionToken = await (async () => {
    const downloadId = `test-dl-${Date.now()}`;
    const { status, body } = await request("/api/images/download-zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageIds: [file.id],
        quality: "original",
        downloadId,
        passphrase: "",
      }),
    });

    if (status !== 200) {
      check(
        "create session returns 200",
        false,
        `got ${status}: ${body.toString()}`,
      );
      return null;
    }

    const data = JSON.parse(body.toString());
    check("create session returns 200", true);
    check(
      "create session returns sessionToken",
      typeof data.sessionToken === "string" && data.sessionToken.length > 0,
    );
    check(
      "create session echoes downloadId",
      data.downloadId === downloadId,
      `got ${data.downloadId}`,
    );
    check(
      "create session reports totalFiles",
      data.totalFiles === 1,
      `got ${data.totalFiles}`,
    );
    return data.sessionToken;
  })();

  if (sessionToken) {
    console.log("");
    console.log("[4] Session polling (/api/images/download-zip/status/:token)");
    {
      const { status, body } = await request(
        `/api/images/download-zip/status/${sessionToken}`,
      );
      check(
        "status returns 200 while session is active",
        status === 200,
        `got ${status}`,
      );
      if (status === 200) {
        const data = JSON.parse(body.toString());
        check("status reports active", data.active === true);
      }

      const { status: s2 } = await request(
        "/api/images/download-zip/status/does-not-exist",
      );
      check("status returns 404 for unknown token", s2 === 404, `got ${s2}`);
    }

    console.log("");
    console.log("[5] ZIP stream (/api/images/download-zip/:token)");
    {
      const { status, body, res } = await request(
        `/api/images/download-zip/${sessionToken}`,
      );
      if (originalOnDisk) {
        check("zip stream returns 200", status === 200, `got ${status}`);
        if (status === 200) {
          check(
            "zip content-type is application/zip",
            (res.headers.get("content-type") || "").includes("application/zip"),
          );
          check(
            "zip is a valid archive (PK magic)",
            body.length > 4 && body.subarray(0, 2).toString() === "PK",
          );
          check("zip is non-empty", body.length > 22, `${body.length} bytes`);
          check(
            "zip contains the selected file",
            body.includes(Buffer.from(file.fileName)),
            file.fileName,
          );
        }
      } else {
        // All bytes missing on disk -> must fail loudly, never stream an empty zip.
        check(
          "zip stream returns 400 when no files are on disk",
          status === 400,
          `got ${status} (${body.toString().slice(0, 120)})`,
        );
      }

      const { status: s2 } = await request(
        "/api/images/download-zip/does-not-exist",
      );
      check(
        "zip stream returns 404 for unknown token",
        s2 === 404,
        `got ${s2}`,
      );
    }
  }

  // --- Cleanup test sessions ---
  try {
    const del = await prisma.downloadSession.deleteMany({
      where: { downloadId: { startsWith: "test-dl-" } },
    });
    console.log("");
    console.log(`Cleaned up ${del.count} test download session(s).`);
  } catch (err) {
    console.warn("");
    console.warn(`Warning: could not clean up test sessions: ${err.message}`);
  }
}

main()
  .catch((err) => {
    console.error("Test run crashed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("");
    console.log(`${passed} passed, ${failed} failed`);
    if (failed > 0) {
      console.log("");
      console.log("Failures:");
      for (const f of failures) console.log(`  - ${f}`);
      process.exit(1);
    }
    process.exit(0);
  });
