/**
 * Download session store backed by Prisma/MySQL.
 * Scalable across multiple server instances (no in-memory Map).
 * Sessions auto-expire after 30 minutes (via expiresAt field + periodic cleanup).
 */

import prisma from "../../../../prisma/client";

export interface DownloadSession {
  imageIds: string[];
  quality: string;
  passphrase?: string;
  downloadId?: string;
  createdAt: number; // Unix timestamp ms
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Periodic cleanup of expired sessions every 5 minutes
setInterval(async () => {
  try {
    await prisma.downloadSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  } catch (err) {
    console.error("[SessionStore] Cleanup error:", err);
  }
}, 5 * 60 * 1000);

export async function createSession(
  data: Omit<DownloadSession, "createdAt">,
): Promise<string> {
  const token = `ds-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await prisma.downloadSession.create({
    data: {
      token,
      imageIds: JSON.stringify(data.imageIds),
      quality: data.quality,
      passphrase: data.passphrase ?? null,
      downloadId: data.downloadId ?? null,
      createdAt: now,
      expiresAt,
    },
  });

  return token;
}

export async function getSession(
  token: string,
): Promise<DownloadSession | undefined> {
  const session = await prisma.downloadSession.findUnique({
    where: { token },
  });

  if (!session) return undefined;

  // Check expiry
  if (session.expiresAt < new Date()) {
    await prisma.downloadSession.delete({ where: { id: session.id } });
    return undefined;
  }

  // Touch the session to extend lifetime
  const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.downloadSession.update({
    where: { id: session.id },
    data: { expiresAt: newExpiresAt },
  });

  return {
    imageIds: JSON.parse(session.imageIds),
    quality: session.quality,
    passphrase: session.passphrase ?? undefined,
    downloadId: session.downloadId ?? undefined,
    createdAt: session.createdAt.getTime(),
  };
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.downloadSession.deleteMany({
    where: { token },
  });
}
