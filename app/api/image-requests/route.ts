import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "../../../prisma/client";
import { sendInternalEvent } from "../../lib/internalEvents";
import { authOptions } from "../auth/[...nextauth]/route";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 200;
const MAX_NAME = 120;
const MAX_NOTE = 500;
const THROTTLE_WINDOW_MS = 60 * 60 * 1000;
const THROTTLE_LIMIT = 10;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const requestAttempts = new Map<string, number[]>();

type RequestStatusValue = "PENDING" | "FULFILLED" | "DISMISSED";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isThrottled(ip: string, now: number): boolean {
  const attempts = (requestAttempts.get(ip) ?? []).filter(
    (at) => now - at < THROTTLE_WINDOW_MS,
  );
  requestAttempts.set(ip, attempts);
  return attempts.length >= THROTTLE_LIMIT;
}

function recordAttempt(ip: string, now: number): void {
  const attempts = requestAttempts.get(ip) ?? [];
  attempts.push(now);
  requestAttempts.set(ip, attempts);

  if (requestAttempts.size > 5000) {
    for (const [key, times] of requestAttempts) {
      if (times.every((at) => now - at >= THROTTLE_WINDOW_MS)) {
        requestAttempts.delete(key);
      }
    }
  }
}

async function canRequestFile(
  request: NextRequest,
  folder: { id: string; isPrivate: boolean; passphrase: string | null },
  passphrase: string,
): Promise<boolean> {
  if (!folder.isPrivate) return true;

  const session = await getServerSession(authOptions);
  if (session?.user) return true;

  if (passphrase && folder.passphrase && passphrase === folder.passphrase) {
    return true;
  }

  const token = request.cookies.get(`access_folder_${folder.id}`)?.value;
  if (!token) return false;

  const link = await prisma.accessLink.findUnique({ where: { token } });
  return Boolean(
    link &&
      link.folderId === folder.id &&
      (!link.expiresAt || link.expiresAt > new Date()) &&
      (link.usesLeft === null || link.usesLeft > 0),
  );
}

export async function POST(request: NextRequest) {
  const now = Date.now();
  const ip = getClientIp(request);

  if (isThrottled(ip, now)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    fileId?: unknown;
    email?: unknown;
    name?: unknown;
    note?: unknown;
    visitorId?: unknown;
    passphrase?: unknown;
  } | null;

  const fileId = typeof body?.fileId === "string" ? body.fileId.trim() : "";
  if (!fileId) {
    return NextResponse.json({ error: "Missing file id" }, { status: 400 });
  }

  try {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        fileName: true,
        folder: {
          select: { id: true, name: true, isPrivate: true, passphrase: true },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const passphrase =
      typeof body?.passphrase === "string" ? body.passphrase : "";

    if (!(await canRequestFile(request, file.folder, passphrase))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (email.length > MAX_EMAIL) {
      return NextResponse.json(
        { error: `Email must be at most ${MAX_EMAIL} characters.` },
        { status: 400 },
      );
    }
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }
    if (name.length > MAX_NAME) {
      return NextResponse.json(
        { error: `Name must be at most ${MAX_NAME} characters.` },
        { status: 400 },
      );
    }
    if (note.length > MAX_NOTE) {
      return NextResponse.json(
        { error: `Note must be at most ${MAX_NOTE} characters.` },
        { status: 400 },
      );
    }

    const visitorId =
      typeof body?.visitorId === "string" && body.visitorId.trim()
        ? body.visitorId.trim().slice(0, 100)
        : `ip:${ip}`;

    const duplicate = await prisma.imageRequest.findFirst({
      where: email
        ? { fileId, status: "PENDING", email }
        : {
            fileId,
            status: "PENDING",
            visitorId,
            createdAt: { gt: new Date(now - DEDUPE_WINDOW_MS) },
          },
      orderBy: { createdAt: "desc" },
    });

    if (duplicate) {
      recordAttempt(ip, now);
      return NextResponse.json(
        { duplicate: true, request: duplicate },
        { status: 200 },
      );
    }

    const created = await prisma.imageRequest.create({
      data: {
        fileId,
        email: email || null,
        name: name || null,
        note: note || null,
        visitorId,
      },
      include: {
        file: {
          select: {
            fileName: true,
            folder: { select: { name: true } },
          },
        },
      },
    });

    sendInternalEvent({
      type: "raw-request",
      payload: {
        requestId: created.id,
        fileId,
        fileName: created.file.fileName,
        folderName: created.file.folder.name,
        email: created.email,
      },
    });

    recordAttempt(ip, now);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create image request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = (searchParams.get("status") || "PENDING").toUpperCase();

  if (
    statusParam !== "ALL" &&
    statusParam !== "PENDING" &&
    statusParam !== "FULFILLED" &&
    statusParam !== "DISMISSED"
  ) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const status =
    statusParam === "ALL" ? undefined : (statusParam as RequestStatusValue);

  const requestedLimit = Number.parseInt(
    searchParams.get("limit") || "100",
    10,
  );
  const requestedOffset = Number.parseInt(
    searchParams.get("offset") || "0",
    10,
  );
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 200)
    : 100;
  const offset =
    Number.isFinite(requestedOffset) && requestedOffset > 0
      ? requestedOffset
      : 0;

  try {
    const [requests, grouped] = await Promise.all([
      prisma.imageRequest.findMany({
        where: status ? { status } : undefined,
        include: {
          file: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              folder: { select: { id: true, name: true } },
              variants: { select: { name: true, path: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.imageRequest.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const counts: Record<RequestStatusValue, number> = {
      PENDING: 0,
      FULFILLED: 0,
      DISMISSED: 0,
    };

    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }

    return NextResponse.json({ requests, counts });
  } catch (error) {
    console.error("Failed to load image requests:", error);
    return NextResponse.json(
      { error: "Failed to load requests" },
      { status: 500 },
    );
  }
}
