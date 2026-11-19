#!/usr/bin/env node
/**
 * Integration test for access-link token flows.
 *
 * Verifies against a running server with the new schema applied:
 *   1. A permanent link redeems without a passphrase and sets a long-lived cookie
 *   2. The cookie (and raw token) grant access to a private folder's images
 *   3. The link contains no passphrase
 *   4. Revocation immediately blocks redemption and image access
 *
 * Requirements:
 *   - The app must be running with the updated code (default: http://localhost:3000)
 *   - DATABASE_URL / STORAGE_ROOT in .env
 *   - npx prisma db push must already have been applied
 *
 * Usage:
 *   npm run test:access-links
 *   TEST_BASE_URL=https://repo.nourose.com npm run test:access-links
 *
 * The script only adds one temporary AccessLink row and deletes it afterwards.
 * Exit code 0 = all checks passed, 1 = at least one check failed.
 */

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

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

async function main() {
  console.log(`Access-link tests against ${BASE_URL}`);
  console.log("");

  let link = null;

  try {
    const folder = await prisma.folder.findFirst({
      where: { isPrivate: true, archived: false, passphrase: { not: null } },
      select: { id: true, passphrase: true },
    });
    check("found a private folder with a passphrase", !!folder);
    if (!folder) return;

    // Create a permanent link directly in the DB (the admin POST endpoint is
    // session-gated; this exercises the same row shape it creates).
    link = await prisma.accessLink.create({
      data: {
        folderId: folder.id,
        expiresAt: null,
        usesLeft: null,
        isPermanent: true,
      },
    });
    check("permanent link row created", link.isPermanent === true);
    check("permanent link has unlimited uses", link.usesLeft === null);

    // --- Redeem ---
    const redeem = await fetch(`${BASE_URL}/api/access-links/${link.token}`, {
      redirect: "manual",
    });
    check("permanent link redeems", redeem.status === 200, `got ${redeem.status}`);
    const redeemData = await redeem.json().catch(() => ({}));
    check("redeem response marks link permanent", redeemData.permanent === true);
    const setCookie = redeem.headers.get("set-cookie") || "";
    check("redeem sets httpOnly cookie", setCookie.includes("HttpOnly"));
    const cookieMaxAgeDays = (() => {
      const match = setCookie.match(/expires=([^;]+)/i);
      if (!match) return 0;
      return Math.round(
        (new Date(match[1]).getTime() - Date.now()) / 1000 / 60 / 60 / 24,
      );
    })();
    check(
      "cookie lasts far longer than 7 days",
      cookieMaxAgeDays > 30,
      `got ${cookieMaxAgeDays} days`,
    );

    const cookieName = `access_folder_${folder.id}`;
    const cookieHeader = `${cookieName}=${link.token}`;

    // --- Image access without passphrase ---
    const withCookie = await fetch(
      `${BASE_URL}/api/images/repo?limit=1&folderId=${folder.id}`,
      { headers: { cookie: cookieHeader } },
    );
    check(
      "cookie grants image access without passphrase",
      withCookie.status === 200,
      `got ${withCookie.status}`,
    );

    const withToken = await fetch(
      `${BASE_URL}/api/images/repo?limit=1&folderId=${folder.id}&t=${link.token}`,
    );
    check(
      "raw token grants image access without passphrase",
      withToken.status === 200,
      `got ${withToken.status}`,
    );

    const withWrongPassphrase = await fetch(
      `${BASE_URL}/api/images/repo?limit=1&folderId=${folder.id}&passphrase=definitely-wrong`,
    );
    check(
      "wrong passphrase alone is rejected",
      withWrongPassphrase.status === 401 || withWrongPassphrase.status === 403,
      `got ${withWrongPassphrase.status}`,
    );

    check(
      "link token does not contain the passphrase",
      !link.token.includes(folder.passphrase),
    );

    // --- Redeem twice (permanent links are not consumed) ---
    const redeemAgain = await fetch(
      `${BASE_URL}/api/access-links/${link.token}`,
      { redirect: "manual" },
    );
    check(
      "permanent link still valid after repeated redemption",
      redeemAgain.status === 200,
      `got ${redeemAgain.status}`,
    );

    // --- Revocation ---
    await prisma.accessLink.update({
      where: { id: link.id },
      data: { revokedAt: new Date() },
    });

    const afterRevokeRedeem = await fetch(
      `${BASE_URL}/api/access-links/${link.token}`,
      { redirect: "manual" },
    );
    check(
      "revoked link cannot be redeemed",
      afterRevokeRedeem.status === 410,
      `got ${afterRevokeRedeem.status}`,
    );

    const afterRevokeImages = await fetch(
      `${BASE_URL}/api/images/repo?limit=1&folderId=${folder.id}&t=${link.token}`,
    );
    check(
      "revoked token cannot access images",
      afterRevokeImages.status === 401 || afterRevokeImages.status === 403,
      `got ${afterRevokeImages.status}`,
    );
  } catch (err) {
    check("test completed without throwing", false, err.message);
  } finally {
    if (link) {
      await prisma.accessLink.deleteMany({ where: { id: link.id } });
      console.log("\n  (temporary test link removed)");
    }
    await prisma.$disconnect();
  }

  console.log("");
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main();
