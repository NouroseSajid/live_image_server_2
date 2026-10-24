import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../prisma/client";

const VIEW_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_DEDUPE_ENTRIES = 5000;

/**
 * Best-effort server-side dedupe. The primary guard lives in sessionStorage on
 * the client; this map only protects against repeated beacons from the same
 * visitor (e.g. a page reload that lost storage). It resets on restart and is
 * not shared between instances.
 */
const recentViews = new Map<string, number>();

function pruneViews(now: number): void {
  if (recentViews.size <= MAX_DEDUPE_ENTRIES) return;

  for (const [key, seenAt] of recentViews) {
    if (now - seenAt >= VIEW_TTL_MS) recentViews.delete(key);
  }

  if (recentViews.size <= MAX_DEDUPE_ENTRIES) return;

  const overflow = recentViews.size - MAX_DEDUPE_ENTRIES;
  let removed = 0;
  for (const key of recentViews.keys()) {
    if (removed >= overflow) break;
    recentViews.delete(key);
    removed += 1;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing image id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    visitorId?: unknown;
  } | null;

  const visitorId =
    typeof body?.visitorId === "string"
      ? body.visitorId.trim().slice(0, 100)
      : "";

  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const dedupeKey = `${visitorId || ip}:${id}`;
  const now = Date.now();
  const lastSeen = recentViews.get(dedupeKey);

  if (lastSeen && now - lastSeen < VIEW_TTL_MS) {
    return NextResponse.json({ ok: true, counted: false });
  }

  try {
    const file = await prisma.file.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Deliberately no folder authorization: a view is a popularity signal, not
    // access control. The lightbox only renders images the visitor can see.
    await prisma.file.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(now),
      },
    });

    recentViews.set(dedupeKey, now);
    pruneViews(now);

    return NextResponse.json({ ok: true, counted: true });
  } catch (error) {
    console.error("Failed to record view:", error);
    return NextResponse.json(
      { error: "Failed to record view" },
      { status: 500 },
    );
  }
}
