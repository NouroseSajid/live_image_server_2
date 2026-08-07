// app/api/images/download-zip/status/[sessionToken]/route.ts
// Lightweight endpoint for polling download session liveness.

import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "../../sessionStore";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> },
) {
  const { sessionToken } = await params;

  const session = await getSession(sessionToken);
  if (!session) {
    // Session expired or download already completed
    return NextResponse.json({ active: false }, { status: 404 });
  }

  return NextResponse.json({
    active: true,
    downloadId: session.downloadId,
    createdAt: session.createdAt,
  });
}

// Next.js automatically handles HEAD via the GET handler, but we
// export it explicitly for clarity since the status check is
// primarily used by the polling fallback which does HEAD requests.
export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> },
) {
  const { sessionToken } = await params;
  const session = await getSession(sessionToken);
  return new NextResponse(null, {
    status: session ? 200 : 404,
  });
}
