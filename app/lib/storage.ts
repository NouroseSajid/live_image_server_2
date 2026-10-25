import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  copyFile,
  link,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Storage abstraction for every image byte the app writes or reads.
 *
 * Objects are addressed by a *storage key* — the exact `/images/...` strings
 * already stored in `Variant.path`, e.g.
 *
 *   /images/{folderId}/{variant}/{fileName}
 *
 * The local driver maps a key to `STORAGE_ROOT/<key without leading slash>`.
 * That root is deliberately **outside** the Next.js project: keeping ~50 GB of
 * media out of `process.cwd()` stops Turbopack from tracing it during builds,
 * and makes the data directory independent of the app checkout.
 *
 * Because keys are already S3-shaped (`images/...`), switching to a bucket is
 * a configuration change: set `STORAGE_DRIVER=s3`, the bucket/credentials env
 * vars, and point `NEXT_PUBLIC_STORAGE_BASE_URL` at the bucket/CDN. No DB
 * migration is needed.
 *
 * Server-only module. Never import from a `"use client"` component.
 */

export type StorageKey = string;

export interface StorageStat {
  size: number;
}

export interface WriteStreamOptions {
  /** Reject uploads larger than this many bytes (best-effort for streams). */
  maxSize?: number;
}

export interface ReadRange {
  start: number;
  end: number;
}

export interface ReadResult {
  stream: Readable;
  /** Total object size in bytes. */
  size: number;
  /** Bytes that will be sent (differs from `size` for ranged reads). */
  contentLength: number;
}

export interface LocalFile {
  path: string;
  /** Removes any temporary copy. Safe to call more than once. */
  dispose: () => Promise<void>;
}

export interface CopyOptions {
  /**
   * Try to hard-link instead of copying bytes. Local-only optimisation:
   * S3 drivers ignore it and always copy.
   */
  preferLink?: boolean;
}

export interface StorageDriver {
  readonly name: string;

  /** Create an empty directory marker (no-op for object stores). */
  ensureDir(key: StorageKey): Promise<void>;

  write(key: StorageKey, data: Uint8Array): Promise<void>;
  writeStream(
    key: StorageKey,
    body: Readable | ReadableStream<Uint8Array>,
    options?: WriteStreamOptions,
  ): Promise<{ size: number }>;

  stat(key: StorageKey): Promise<StorageStat | null>;
  exists(key: StorageKey): Promise<boolean>;
  read(key: StorageKey, range?: ReadRange): Promise<ReadResult>;

  remove(key: StorageKey): Promise<void>;
  removePrefix(prefix: StorageKey): Promise<void>;
  existsPrefix(prefix: StorageKey): Promise<boolean>;

  move(from: StorageKey, to: StorageKey): Promise<void>;
  movePrefix(fromPrefix: StorageKey, toPrefix: StorageKey): Promise<void>;
  copy(from: StorageKey, to: StorageKey, options?: CopyOptions): Promise<void>;

  /** Recursively list keys under a prefix. */
  list(prefix: StorageKey): Promise<StorageKey[]>;

  /**
   * Materialise a key as a local file for consumers that need a path (zip
   * archiving, for example). The caller must invoke `dispose()` when done.
   */
  openLocal(key: StorageKey): Promise<LocalFile>;
}

/**
 * Normalise a DB path / storage key into a safe relative key.
 * Leading slashes are stripped (`/images/...` → `images/...`), then traversal
 * (`..`), empty segments and empty keys are rejected.
 */
export function normalizeStorageKey(key: StorageKey): string {
  const cleaned = String(key ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (!cleaned) {
    throw new Error("Storage key must not be empty");
  }

  const segments = cleaned.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new Error(`Invalid storage key: ${key}`);
  }

  return cleaned;
}

/** Build a storage key from path segments, e.g. storageKey("images", id, "webp"). */
export function storageKey(...parts: Array<string | number>): string {
  return parts
    .map((part) => String(part).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function mimeTypeFor(key: string): string {
  const ext = extname(key).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".ogg": "video/ogg",
    ".ogv": "video/ogg",
  };
  return map[ext] ?? "application/octet-stream";
}

function toNodeReadable(body: Readable | ReadableStream<Uint8Array>): Readable {
  if (body instanceof Readable) return body;
  return Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
}

function requireStorageRoot(): string {
  const root = process.env.STORAGE_ROOT?.trim();
  if (!root) {
    throw new Error(
      "STORAGE_ROOT is not set. Point it at the absolute path that holds the " +
        "images/ directory (e.g. STORAGE_ROOT=/home/user/live_image_server_data).",
    );
  }
  if (!isAbsolute(root)) {
    throw new Error(
      `STORAGE_ROOT must be an absolute path (received "${root}").`,
    );
  }
  return root;
}

class LocalStorageDriver implements StorageDriver {
  readonly name = "local";

  private pathFor(key: StorageKey): string {
    return join(requireStorageRoot(), normalizeStorageKey(key));
  }

  async ensureDir(key: StorageKey): Promise<void> {
    await mkdir(this.pathFor(key), { recursive: true });
  }

  async write(key: StorageKey, data: Uint8Array): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async writeStream(
    key: StorageKey,
    body: Readable | ReadableStream<Uint8Array>,
    options: WriteStreamOptions = {},
  ): Promise<{ size: number }> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });

    // Stream into a sibling temp file first so an interrupted upload never
    // leaves a half-written object under a key the DB may reference.
    const temp = `${target}.${randomUUID()}.part`;
    let size = 0;
    const source = toNodeReadable(body);

    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (options.maxSize && size > options.maxSize) {
          callback(
            new Error(`Upload exceeds limit of ${options.maxSize} bytes`),
          );
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(source, counter, createWriteStream(temp));
      await rename(temp, target);
      return { size };
    } catch (error) {
      await unlink(temp).catch(() => {});
      throw error;
    }
  }

  async stat(key: StorageKey): Promise<StorageStat | null> {
    try {
      const stats = await stat(this.pathFor(key));
      if (!stats.isFile()) return null;
      return { size: stats.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async exists(key: StorageKey): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }

  async read(key: StorageKey, range?: ReadRange): Promise<ReadResult> {
    const stats = await stat(this.pathFor(key));
    if (!stats.isFile()) {
      const error = new Error(`Not a file: ${key}`) as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    if (range) {
      const stream = createReadStream(this.pathFor(key), {
        start: range.start,
        end: range.end,
      });
      return {
        stream,
        size: stats.size,
        contentLength: range.end - range.start + 1,
      };
    }

    return {
      stream: createReadStream(this.pathFor(key)),
      size: stats.size,
      contentLength: stats.size,
    };
  }

  async remove(key: StorageKey): Promise<void> {
    try {
      await unlink(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async removePrefix(prefix: StorageKey): Promise<void> {
    await rm(this.pathFor(prefix), { recursive: true, force: true });
  }

  async existsPrefix(prefix: StorageKey): Promise<boolean> {
    try {
      const stats = await stat(this.pathFor(prefix));
      return stats.isDirectory();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  async move(from: StorageKey, to: StorageKey): Promise<void> {
    const target = this.pathFor(to);
    await mkdir(dirname(target), { recursive: true });
    await rename(this.pathFor(from), target);
  }

  async movePrefix(
    fromPrefix: StorageKey,
    toPrefix: StorageKey,
  ): Promise<void> {
    await this.move(fromPrefix, toPrefix);
  }

  async copy(
    from: StorageKey,
    to: StorageKey,
    options: CopyOptions = {},
  ): Promise<void> {
    const source = this.pathFor(from);
    const target = this.pathFor(to);
    await mkdir(dirname(target), { recursive: true });

    if (options.preferLink) {
      try {
        await link(source, target);
        return;
      } catch (error) {
        // A real collision should surface instead of being masked by a copy.
        if ((error as NodeJS.ErrnoException).code === "EEXIST") throw error;
        // Different filesystem / filesystem without hard links → copy bytes.
      }
    }

    await copyFile(source, target);
  }

  async list(prefix: StorageKey): Promise<StorageKey[]> {
    const root = normalizeStorageKey(prefix);
    const base = this.pathFor(root);
    const results: StorageKey[] = [];

    const walk = async (dir: string, relative: string) => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const entryRelative = relative
          ? `${relative}/${entry.name}`
          : entry.name;
        if (entry.isDirectory()) {
          await walk(join(dir, entry.name), entryRelative);
        } else if (entry.isFile()) {
          results.push(`${root}/${entryRelative}`);
        }
      }
    };

    try {
      await walk(base, "");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    return results;
  }

  async openLocal(key: StorageKey): Promise<LocalFile> {
    return { path: this.pathFor(key), dispose: async () => {} };
  }
}

/* -------------------------------------------------------------------------- */
/* S3 driver (optional)                                                        */
/* -------------------------------------------------------------------------- */

type AwsSdk = {
  // Loose typing keeps the SDK an optional runtime dependency.
  S3Client: new (
    config: Record<string, unknown>,
  ) => {
    send: (command: unknown) => Promise<Record<string, unknown>>;
  };
  GetObjectCommand: new (input: Record<string, unknown>) => unknown;
  HeadObjectCommand: new (input: Record<string, unknown>) => unknown;
  PutObjectCommand: new (input: Record<string, unknown>) => unknown;
  CopyObjectCommand: new (input: Record<string, unknown>) => unknown;
  DeleteObjectCommand: new (input: Record<string, unknown>) => unknown;
  DeleteObjectsCommand: new (input: Record<string, unknown>) => unknown;
  ListObjectsV2Command: new (input: Record<string, unknown>) => unknown;
};

function loadAwsSdk(): AwsSdk {
  // Resolve the SDK at runtime so builds work without AWS packages installed.
  const requireFromApp = createRequire(join(process.cwd(), "package.json"));
  try {
    return requireFromApp("@aws-sdk/client-s3") as AwsSdk;
  } catch {
    throw new Error(
      "STORAGE_DRIVER=s3 requires the AWS SDK. Run " +
        "`npm install @aws-sdk/client-s3 @aws-sdk/lib-storage` and restart. " +
        "Storage keys are already S3 object keys, so no data migration is needed.",
    );
  }
}

class S3StorageDriver implements StorageDriver {
  readonly name = "s3";

  private readonly bucket: string;
  private readonly sdk: AwsSdk;
  private readonly client: InstanceType<AwsSdk["S3Client"]>;

  constructor() {
    const bucket = process.env.STORAGE_S3_BUCKET?.trim();
    if (!bucket) {
      throw new Error("STORAGE_S3_BUCKET is required when STORAGE_DRIVER=s3");
    }
    this.bucket = bucket;
    this.sdk = loadAwsSdk();
    this.client = new this.sdk.S3Client({
      region: process.env.STORAGE_S3_REGION || undefined,
      endpoint: process.env.STORAGE_S3_ENDPOINT || undefined,
      forcePathStyle:
        process.env.STORAGE_S3_FORCE_PATH_STYLE === "true" || undefined,
      credentials:
        process.env.STORAGE_S3_ACCESS_KEY_ID &&
        process.env.STORAGE_S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  async ensureDir(_key: StorageKey): Promise<void> {
    // Object stores have no directories.
  }

  async write(key: StorageKey, data: Uint8Array): Promise<void> {
    await this.client.send(
      new this.sdk.PutObjectCommand({
        Bucket: this.bucket,
        Key: normalizeStorageKey(key),
        Body: data,
        ContentType: mimeTypeFor(key),
      }),
    );
  }

  async writeStream(
    key: StorageKey,
    body: Readable | ReadableStream<Uint8Array>,
    _options: WriteStreamOptions = {},
  ): Promise<{ size: number }> {
    const requireFromApp = createRequire(join(process.cwd(), "package.json"));
    let Upload: new (
      config: Record<string, unknown>,
    ) => {
      done: () => Promise<unknown>;
    };

    try {
      ({ Upload } = requireFromApp("@aws-sdk/lib-storage"));
    } catch {
      throw new Error(
        "Streaming uploads to S3 require @aws-sdk/lib-storage. " +
          "Run `npm install @aws-sdk/lib-storage` and restart.",
      );
    }

    let size = 0;
    const source = toNodeReadable(body);
    const counted = async function* (chunks: AsyncIterable<Buffer>) {
      for await (const chunk of chunks) {
        size += chunk.length;
        yield chunk;
      }
    };

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: normalizeStorageKey(key),
        Body: Readable.from(counted(source)),
        ContentType: mimeTypeFor(key),
      },
    });

    await upload.done();
    return { size };
  }

  async stat(key: StorageKey): Promise<StorageStat | null> {
    try {
      const result = await this.client.send(
        new this.sdk.HeadObjectCommand({
          Bucket: this.bucket,
          Key: normalizeStorageKey(key),
        }),
      );
      return { size: Number(result.ContentLength ?? 0) };
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "NotFound" || name === "NoSuchKey") return null;
      throw error;
    }
  }

  async exists(key: StorageKey): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }

  async read(key: StorageKey, range?: ReadRange): Promise<ReadResult> {
    const stats = await this.stat(key);
    if (!stats) {
      const error = new Error(
        `No such object: ${key}`,
      ) as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    const result = await this.client.send(
      new this.sdk.GetObjectCommand({
        Bucket: this.bucket,
        Key: normalizeStorageKey(key),
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );

    const body = result.Body as Readable | undefined;
    if (!body) throw new Error(`Empty response body for ${key}`);

    return {
      stream: body,
      size: stats.size,
      contentLength: range ? range.end - range.start + 1 : stats.size,
    };
  }

  async remove(key: StorageKey): Promise<void> {
    try {
      await this.client.send(
        new this.sdk.DeleteObjectCommand({
          Bucket: this.bucket,
          Key: normalizeStorageKey(key),
        }),
      );
    } catch (error) {
      if ((error as { name?: string }).name !== "NoSuchKey") throw error;
    }
  }

  async removePrefix(prefix: StorageKey): Promise<void> {
    const keys = await this.list(prefix);
    for (const key of keys) {
      await this.remove(key);
    }
  }

  async existsPrefix(prefix: StorageKey): Promise<boolean> {
    const keys = await this.list(prefix);
    return keys.length > 0;
  }

  async move(from: StorageKey, to: StorageKey): Promise<void> {
    await this.copy(from, to);
    await this.remove(from);
  }

  async movePrefix(
    fromPrefix: StorageKey,
    toPrefix: StorageKey,
  ): Promise<void> {
    const keys = await this.list(fromPrefix);
    const source = normalizeStorageKey(fromPrefix);
    const target = normalizeStorageKey(toPrefix);

    for (const key of keys) {
      const relative = key.slice(source.length).replace(/^\/+/, "");
      await this.move(key, relative ? `${target}/${relative}` : target);
    }
  }

  async copy(
    from: StorageKey,
    to: StorageKey,
    _options: CopyOptions = {},
  ): Promise<void> {
    const encodedSource = normalizeStorageKey(from)
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    await this.client.send(
      new this.sdk.CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodedSource}`,
        Key: normalizeStorageKey(to),
        ContentType: mimeTypeFor(to),
      }),
    );
  }

  async list(prefix: StorageKey): Promise<StorageKey[]> {
    const normalised = normalizeStorageKey(prefix);
    const keys: StorageKey[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await this.client.send(
        new this.sdk.ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `${normalised}/`,
          ContinuationToken: continuationToken,
        }),
      );

      for (const item of (result.Contents as { Key?: string }[] | undefined) ??
        []) {
        if (item.Key) keys.push(item.Key);
      }
      continuationToken = result.IsTruncated
        ? (result.NextContinuationToken as string | undefined)
        : undefined;
    } while (continuationToken);

    return keys;
  }

  async openLocal(key: StorageKey): Promise<LocalFile> {
    const { stream } = await this.read(key);
    const temp = join(tmpdir(), `storage-${randomUUID()}${extname(key)}`);
    await pipeline(stream, createWriteStream(temp));

    let disposed = false;
    return {
      path: temp,
      dispose: async () => {
        if (disposed) return;
        disposed = true;
        await unlink(temp).catch(() => {});
      },
    };
  }
}

/* -------------------------------------------------------------------------- */

let driver: StorageDriver | null = null;

function createDriver(): StorageDriver {
  const kind = (process.env.STORAGE_DRIVER || "local").trim().toLowerCase();
  if (kind === "local") return new LocalStorageDriver();
  if (kind === "s3") return new S3StorageDriver();
  throw new Error(
    `Unknown STORAGE_DRIVER "${kind}". Supported drivers: local, s3.`,
  );
}

/** Lazily resolve the configured storage driver (env is read on first use). */
export function getStorage(): StorageDriver {
  if (!driver) driver = createDriver();
  return driver;
}
