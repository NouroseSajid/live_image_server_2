"use client";

const VISITOR_KEY = "galleryVisitorId";
const VIEWED_PREFIX = "viewed:";

function fallbackVisitorId(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Stable per-browser-session id used to dedupe views and anonymous requests.
 * Kept in sessionStorage so a new tab/session counts as a new visitor.
 */
export function getVisitorId(): string {
  if (typeof window === "undefined") return fallbackVisitorId();

  try {
    const existing = window.sessionStorage.getItem(VISITOR_KEY);
    if (existing) return existing;

    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : fallbackVisitorId();

    window.sessionStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return fallbackVisitorId();
  }
}

/**
 * Records a lightbox impression once per browser session. Failures are
 * intentionally swallowed: analytics must never interrupt viewing.
 */
export function recordImageView(imageId: string): void {
  if (typeof window === "undefined" || !imageId) return;

  const key = `${VIEWED_PREFIX}${imageId}`;

  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage can be unavailable (private mode). The server-side dedupe is a
    // second line of defence, so still send the beacon.
  }

  void fetch(`/api/images/${encodeURIComponent(imageId)}/view`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId: getVisitorId() }),
  }).catch(() => {
    // Best-effort metric.
  });
}
