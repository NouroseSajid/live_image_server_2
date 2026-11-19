import prisma from "../../prisma/client";

export const TEMP_LINK_COOKIE_MS = 1000 * 60 * 60 * 24 * 7;
export const PERMANENT_LINK_COOKIE_MS = 1000 * 60 * 60 * 24 * 365;

export interface AccessLinkCheck {
  valid: boolean;
  permanent: boolean;
}

/**
 * Shared validation for access-link tokens. Every endpoint that grants access
 * to a private folder must use this so permanent links stay revocable and
 * one-time links keep their expiry/use limits.
 */
export async function checkAccessLink(
  token: string | null | undefined,
  folderId: string,
): Promise<AccessLinkCheck> {
  if (!token) return { valid: false, permanent: false };

  const link = await prisma.accessLink.findUnique({ where: { token } });
  if (!link || link.folderId !== folderId || link.revokedAt) {
    return { valid: false, permanent: false };
  }

  if (!link.isPermanent) {
    if (link.expiresAt && link.expiresAt < new Date()) {
      return { valid: false, permanent: false };
    }
    if (link.usesLeft !== null && link.usesLeft <= 0) {
      return { valid: false, permanent: false };
    }
  }

  return { valid: true, permanent: link.isPermanent };
}
