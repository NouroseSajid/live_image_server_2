"use client";
import { useEffect, useMemo, useState } from "react";
import { MdInfo } from "react-icons/md";
import { buildRows, type Image } from "../lib/imageData";
import { useFetch } from "../lib/useFetch";
import ActionBar from "./ActionBar";
import CategoryNavigation from "./CategoryNavigation";
import DownloadProgress from "./DownloadProgress";
import ErrorDisplay from "./gallerycomponents/ErrorDisplay";
import PassphraseModal from "./gallerycomponents/PassphraseModal";
import { useContainerWidth } from "./gallerycomponents/useContainerWidth";
import { useImageFetch } from "./gallerycomponents/useImageFetch";
import { useInfiniteScroll } from "./gallerycomponents/useInfiniteScroll";
import ImageGrid from "./ImageGrid";
import Lightbox from "./Lightbox";
import QualityModal from "./QualityModal";

interface FetchedImage {
  id: string;
  fileName: string;
  folderId: string;
  fileType: "image" | "video";
  mimeType?: string;
  variants: {
    name: string;
    path: string;
    size?: number;
  }[];
  width: number;
  height: number;
  url: string;
  category: string;
  title: string;
  meta: string;
  createdAt?: string;
}
interface Folder {
  id: string;
  name: string;
  isPrivate?: boolean;
  passphrase?: string | null;
  inGridView?: boolean;
  groupId?: string | null;
  group?: {
    id: string;
    name: string;
    position?: number;
  } | null;
  thumbnail?: {
    id: string;
    variants: Array<{
      path: string;
    }>;
  } | null;
  _count?: {
    files: number;
  };
}

interface GalleryConfig {
  allFolderThumbnailUrl: string | null;
  folderMaxAgeMinutes?: Record<string, number | null>;
}

interface GalleryOrderItem {
  type: "folder" | "group";
  id: string;
}

interface GalleryProps {
  initialFolderId?: string;
}

export default function Gallery({ initialFolderId }: GalleryProps = {}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>(initialFolderId || "all");
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [lightboxImg, setLightboxImg] = useState<Image | null>(null);
  const [_scrolled, setScrolled] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    id: string;
    totalFiles: number;
  } | null>(null);
  const [allFolderThumbnailUrl, setAllFolderThumbnailUrl] = useState<string | null>(null);
  const [folderMaxAgeMinutes, setFolderMaxAgeMinutes] = useState<
    Record<string, number | null>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [folderPassphrases, setFolderPassphrases] = useState<Record<string, string>>({});
  const [passphraseModal, setPassphraseModal] = useState<{
    folderId: string;
    name: string;
  } | null>(null);
  const [passphraseError, setPassphraseError] = useState<string>("");
  const BATCH_SIZE = 20;
  const { containerRef, width } = useContainerWidth();

  const redirectToMain = (message?: string, clearFolderId?: string) => {
    if (clearFolderId) {
      setFolderPassphrases((prev) => {
        const next = { ...prev };
        delete next[clearFolderId];
        return next;
      });
    }
    setActiveFolder("all");
    setPassphraseModal(null);
    setPassphraseError("");
    if (message) {
      setError(message);
    }
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
  };

  const { images, setImages, isLoading, hasMore } = useImageFetch({
    activeFolder,
    offset,
    batchSize: BATCH_SIZE,
    folders,
    folderPassphrases,
    passphraseModal,
    onPassphraseRequired: (folderId, folderName) => {
      const attemptedPassphrase = folderPassphrases[folderId];
      setFolderPassphrases((prev) => {
        const next = { ...prev };
        delete next[folderId];
        return next;
      });
      if (attemptedPassphrase) {
        redirectToMain("Wrong passphrase. Redirected to the main page.");
        return;
      }
      setPassphraseModal({ folderId, name: folderName });
      setPassphraseError("Passphrase required");
    },
    onError: setError,
  });

  const { sentinelRef, triggerLoadMore } = useInfiniteScroll({
    isLoading,
    hasMore,
    onLoadMore: () => setOffset((prev) => prev + BATCH_SIZE),
  });

  const { data: foldersData, error: foldersError } =
    useFetch<Folder[]>("/api/folders?scope=public");

  const { data: galleryConfigData } = useFetch<GalleryConfig>(
    "/api/gallery-config",
  );

  const { data: galleryOrderData } = useFetch<GalleryOrderItem[]>(
    "/api/gallery-order",
  );

  useEffect(() => {
    if (foldersData) {
      setFolders(foldersData);
    }
    if (foldersError) {
      setError("Failed to load folders. Retrying automatically...");
    }
  }, [foldersData, foldersError]);

  useEffect(() => {
    if (galleryConfigData) {
      setAllFolderThumbnailUrl(galleryConfigData.allFolderThumbnailUrl ?? null);
      setFolderMaxAgeMinutes(galleryConfigData.folderMaxAgeMinutes ?? {});
    }
  }, [galleryConfigData]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const folderParam = params.get("f");
    const passphraseParam = params.get("p");
    const tokenParam = params.get("t") || params.get("token");

    try {
      const sessionStored = sessionStorage.getItem("folderPassphrases");
      if (sessionStored) {
        const sessionPassphrases = JSON.parse(sessionStored);
        setFolderPassphrases((prev) => ({ ...prev, ...sessionPassphrases }));
        sessionStorage.removeItem("folderPassphrases");
      }
    } catch (err) {
      console.error("[Gallery] Failed to restore session passphrases", err);
    }

    const applyFolder = (id: string) => {
      setActiveFolder(id);
      window.history.replaceState({}, "", `?f=${id}`);
    };

    const maybeValidateToken = async () => {
      if (!tokenParam) return;
      try {
        const res = await fetch(`/api/access-links/${tokenParam}`);
        if (res.ok) {
          const data = await res.json();
          applyFolder(data.folderId);
        } else {
          setError("Access link is invalid or expired.");
        }
      } catch (err) {
        console.error("[Gallery] Failed to validate token", err);
        setError("Access link validation failed.");
      }
    };

    if (tokenParam) {
      maybeValidateToken();
      return;
    }

    if (folderParam) {
      applyFolder(folderParam);

      if (passphraseParam) {
        setFolderPassphrases((prev) => ({
          ...prev,
          [folderParam]: decodeURIComponent(passphraseParam),
        }));
        window.history.replaceState({}, "", `?f=${folderParam}`);
      }
    }
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("folderPassphrases");
      if (cached) {
        setFolderPassphrases((prev) => ({ ...prev, ...JSON.parse(cached) }));
      }
    } catch (err) {
      console.error("[Gallery] Failed to load cached passphrases", err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("folderPassphrases", JSON.stringify(folderPassphrases));
    } catch (err) {
      console.error("[Gallery] Failed to persist passphrases", err);
    }
  }, [folderPassphrases]);

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connectWebSocket = async () => {
      try {
        const configRes = await fetch("/api/config");
        const config = await configRes.json();
        const wsUrl = config.wsUrl || "ws://localhost:8080";

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[Gallery] Connected to WebSocket server at", wsUrl);
        };

        ws.onmessage = async (event) => {
          try {
            let data = event.data;
            if (data instanceof Blob) {
              data = await data.text();
            }

            const message = JSON.parse(data);
            if (message.type === "new-file" && message.payload) {
              const newFile = message.payload;
              console.log("[Gallery] Received new file:", newFile.fileName);

              const newImage: FetchedImage = {
                id: newFile.id,
                fileName: newFile.fileName,
                folderId: newFile.folderId,
                fileType: newFile.fileType,
                variants: newFile.variants || [],
                width: newFile.width ?? 1920,
                height: newFile.height ?? 1080,
                url:
                  newFile.variants?.find((v: any) => v.name === "thumbnail")?.path ||
                  newFile.variants?.find((v: any) => v.name === "thumb")?.path ||
                  newFile.variants?.[0]?.path ||
                  "/icons/video-placeholder.svg",
                category: newFile.folderId,
                title: newFile.fileName,
                meta: `${newFile.width ?? "?"}x${newFile.height ?? "?"}`,
                createdAt: newFile.createdAt || new Date().toISOString(),
              };

              setImages((prev) => [newImage, ...prev]);
            }
          } catch (error) {
            console.error("[Gallery] Error processing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("[Gallery] WebSocket error:", error);
        };

        ws.onclose = () => {
          console.log("[Gallery] WebSocket disconnected");
        };
      } catch (err) {
        console.error("[Gallery] Failed to get WebSocket config:", err);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [setImages]);

  useEffect(() => {
    setOffset(0);
    setSelectedIds(new Set());
  }, [activeFolder]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const maxAgeMinutes = folderMaxAgeMinutes?.[activeFolder] ?? null;

  const filteredImages = useMemo(() => {
    const base =
      activeFolder === "all"
        ? images
        : images.filter((i) => i.folderId === activeFolder);

    if (!maxAgeMinutes || maxAgeMinutes <= 0) return base;
    const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
    return base.filter((i) => {
      if (!i.createdAt) return true;
      const created = new Date(i.createdAt).getTime();
      return Number.isFinite(created) ? created >= cutoff : true;
    });
  }, [images, activeFolder, maxAgeMinutes]);

  const processedImages = useMemo(() => {
    return filteredImages.map((image) => {
      const isVideo = image.fileType === "video";
      const thumbnailVariant =
        image.variants.find((v) => v.name === "thumbnail") ||
        image.variants.find((v) => v.name === "thumb");

      const webpVariant = image.variants.find((v) => v.name === "webp");
      const originalVariant = image.variants.find((v) => v.name === "original");

      const convertToApiRoute = (dbPath?: string) => {
        if (!dbPath) return dbPath;
        if (dbPath.startsWith("/icons/")) return dbPath;

        return dbPath.replace(/^\/images\//, "/api/serve/");
      };

      const videoUrl = isVideo
        ? convertToApiRoute(originalVariant?.path) ||
          convertToApiRoute(image.variants[0]?.path)
        : undefined;

      const thumbnailUrl = isVideo
        ? convertToApiRoute(thumbnailVariant?.path) || "/icons/video-placeholder.svg"
        : convertToApiRoute(thumbnailVariant?.path) ||
          convertToApiRoute(image.variants[0]?.path) ||
          "/icons/video-placeholder.svg";

      const lightboxUrl = convertToApiRoute(webpVariant?.path) ||
        convertToApiRoute(originalVariant?.path) ||
        convertToApiRoute(image.variants[0]?.path) ||
        "/icons/video-placeholder.svg";

      return {
        id: image.id,
        width: image.width ?? 1920,
        height: image.height ?? 1080,
        url: thumbnailUrl,
        thumbnailUrl,
        videoUrl,
        isVideo,
        mimeType: image.mimeType,
        originalUrl: isVideo ? videoUrl || lightboxUrl : lightboxUrl,
        category: image.folderId,
        title: image.fileName,
        meta: `${image.width ?? "?"}x${image.height ?? "?"}`,
      };
    });
  }, [filteredImages]);

  const rows = useMemo(
    () => buildRows(processedImages, width, 260, 14),
    [processedImages, width],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === processedImages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedImages.map((i) => i.id)));
    }
  };

  const categories = useMemo(() => {
    const fallbackAllThumbnail =
      allFolderThumbnailUrl ||
      folders.find((folder) => folder.thumbnail?.variants?.[0]?.path)?.thumbnail?.variants?.[0]?.path ||
      null;
    const allCategory = {
      id: "all",
      name: "All",
      thumbnail: fallbackAllThumbnail
        ? { id: "all", variants: [{ path: fallbackAllThumbnail }] }
        : null,
    };
    return [allCategory, ...folders];
  }, [folders, allFolderThumbnailUrl]);

  const handleSelectCategory = (folderId: string) => {
    if (folderId === "all") {
      setActiveFolder(folderId);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
      }
      return;
    }

    const folder = folders.find((f) => f.id === folderId);
    if (folder?.isPrivate) {
      const existing = folderPassphrases[folderId] || "";
      if (existing) {
        setActiveFolder(folderId);
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        if (typeof window !== "undefined" && folder) {
          window.history.replaceState({}, "", `?f=${folder.id}`);
        }
        return;
      }
      setPassphraseModal({ folderId, name: folder.name });
      setPassphraseError("Enter passphrase to unlock");
      return;
    }

    setActiveFolder(folderId);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (typeof window !== "undefined" && folder) {
      window.history.replaceState({}, "", `?f=${folder.id}`);
    }
  };
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans selection:bg-[var(--primary)]/20 pb-24">
      {/* Header */}

      <main ref={containerRef} className="max-w-[1400px] mx-auto px-6 mt-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 flex items-center gap-3">
            <MdInfo className="text-xl flex-shrink-0" />
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-700 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        <CategoryNavigation
          categories={categories}
          orderItems={galleryOrderData || null}
          activeFolder={activeFolder}
          onSelectCategory={handleSelectCategory}
        />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-[var(--foreground)]">
              Latest uploads
            </p>
          </div>
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground)]/80 hover:text-[var(--foreground)] transition-colors px-4 py-1.5 rounded-full border border-[var(--foreground)]/20 hover:border-[var(--foreground)]/40 hover:bg-[var(--foreground)]/10"
          >
            {selectedIds.size === processedImages.length
              ? "Deselect All"
              : "Select All"}
          </button>
        </div>

        <ImageGrid
          rows={rows}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpenImage={setLightboxImg}
        />

        <div ref={sentinelRef} className="h-4" />

        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--foreground)]/60"></div>
            <span className="ml-3 text-[var(--foreground)]/60">Loading more images...</span>
          </div>
        )}

        {!hasMore && processedImages.length > 0 && (
          <div className="text-center py-8 text-[var(--foreground)]/60">
            <p>No more images to load</p>
          </div>
        )}
      </main>

      {error && <ErrorDisplay error={error} onClose={() => setError(null)} />}

      {passphraseModal && (
        <PassphraseModal
          folderName={passphraseModal.name}
          error={passphraseError}
          onSubmit={(passphrase) => {
            setFolderPassphrases((prev) => ({
              ...prev,
              [passphraseModal.folderId]: passphrase,
            }));
            setActiveFolder(passphraseModal.folderId);
            if (typeof window !== "undefined") {
              window.history.replaceState({}, "", `?f=${passphraseModal.folderId}`);
            }
            setError(null);
            setPassphraseModal(null);
            setPassphraseError("");
          }}
          onCancel={() => {
            redirectToMain(undefined, passphraseModal.folderId);
          }}
        />
      )}

      {lightboxImg && (
        (() => {
          const idx = processedImages.findIndex((i) => i.id === lightboxImg.id);
          const hasImages = processedImages.length > 0 && idx !== -1;
          const nextImage = hasImages && idx + 1 < processedImages.length
            ? processedImages[idx + 1]
            : null;
          const prevImage = hasImages && idx - 1 >= 0
            ? processedImages[idx - 1]
            : null;

          return (
        <Lightbox
          image={lightboxImg}
          onClose={() => setLightboxImg(null)}
          onNext={() => {
            const idx = processedImages.findIndex(
              (i) => i.id === lightboxImg.id,
            );
            const next = idx + 1;
            if (next < processedImages.length) {
              setLightboxImg(processedImages[next]);
              return;
            }
            if (hasMore && !isLoading) {
              triggerLoadMore();
            }
          }}
          onPrev={() => {
            const idx = processedImages.findIndex(
              (i) => i.id === lightboxImg.id,
            );
            const prev = idx - 1;
            if (prev >= 0) {
              setLightboxImg(processedImages[prev]);
            }
          }}
          nextImage={nextImage}
          prevImage={prevImage}
          isSelected={selectedIds.has(lightboxImg.id)}
          onToggleSelect={toggleSelect}
          isDownloading={isDownloading}
        />
          );
        })()
      )}

      <ActionBar
        selectedCount={selectedIds.size}
        mediumQualitySize={Array.from(selectedIds).reduce((acc, id) => {
          const fullImage = images.find((i) => i.id === id);
          const variant = fullImage?.variants?.find((v) => v.name === "webp");
          const sizeVal = variant?.size;
          const numeric =
            typeof sizeVal === "bigint"
              ? Number(sizeVal)
              : typeof sizeVal === "string"
                ? Number(sizeVal)
                : sizeVal || 0;
          return acc + (Number.isFinite(numeric) ? numeric : 0);
        }, 0)}
        highQualitySize={Array.from(selectedIds).reduce((acc, id) => {
          const fullImage = images.find((i) => i.id === id);
          const variant = fullImage?.variants?.find(
            (v) => v.name === "original",
          );
          const sizeVal = variant?.size;
          const numeric =
            typeof sizeVal === "bigint"
              ? Number(sizeVal)
              : typeof sizeVal === "string"
                ? Number(sizeVal)
                : sizeVal || 0;
          return acc + (Number.isFinite(numeric) ? numeric : 0);
        }, 0)}
        onClear={() => setSelectedIds(new Set())}
        onDownloadAll={async () => {
          if (selectedIds.size === 0) {
            alert("Please select images to download.");
            return;
          }

          setShowQualityModal(true);
        }}
        isDownloading={isDownloading}
      />

      <QualityModal
        isOpen={showQualityModal}
        onSelect={async (quality) => {
          setShowQualityModal(false);
          setIsDownloading(true);
          setError(null);

          try {
            console.log(
              `[Download] Starting download of ${selectedIds.size} images (quality: ${quality})`,
            );

            const response = await fetch("/api/images/download-zip", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                imageIds: Array.from(selectedIds),
                quality,
              }),
              signal: AbortSignal.timeout(20 * 60 * 1000),
            });

            console.log(
              `[Download] Response received: status=${response.status}`,
            );

            const downloadId = response.headers.get("X-Download-ID") || `dl-${Date.now()}`;

            setDownloadProgress({
              id: downloadId,
              totalFiles: selectedIds.size,
            });

            if (!response.ok) {
              let errorMsg = `Download failed (HTTP ${response.status})`;
              try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
              } catch {
                errorMsg = `${errorMsg}: ${response.statusText}`;
              }
              console.error("[Download] Error:", errorMsg);
              setError(errorMsg);
              return;
            }

            const contentType = response.headers.get("content-type");
            console.log(`[Download] Content-Type: ${contentType}`);
            if (!contentType?.includes("application/zip")) {
              setError("Unexpected response format. Please try again.");
              return;
            }

            console.log("[Download] Reading blob...");
            const blob = await response.blob();
            console.log(
              `[Download] Blob received: ${(blob.size / 1024 / 1024).toFixed(1)}MB`,
            );

            if (blob.size === 0) {
              setError("Downloaded file is empty. Please try again.");
              return;
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "selected_images.zip";
            document.body.appendChild(a);

            console.log("[Download] Triggering browser download...");
            a.click();

            setTimeout(() => {
              window.URL.revokeObjectURL(url);
              a.remove();
            }, 100);

            setSelectedIds(new Set());
            setError(null);
            setShowQualityModal(false);

            const sizeStr = (blob.size / 1024 / 1024).toFixed(1);

            console.log(
              `[Download] Success! File size: ${sizeStr}MB`,
            );

            setTimeout(() => {
              setDownloadProgress(null);
            }, 2000);
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : "Unknown error";
            console.error("[Download] Exception:", errorMsg, error);

            setDownloadProgress(null);

            if (errorMsg.includes("timeout")) {
              setError(
                "Download took too long (20 min). Network may be slow. Try again or select fewer images.",
              );
            } else if (errorMsg.includes("abort")) {
              setError("Download was cancelled or interrupted.");
            } else if (errorMsg.includes("network")) {
              setError(
                "Network error. Check your connection and try again.",
              );
            } else {
              setError(`Download failed: ${errorMsg}`);
            }
          } finally {
            setIsDownloading(false);
          }
        }}
        onCancel={() => setShowQualityModal(false)}
        highQualitySize={Array.from(selectedIds).reduce((acc, id) => {
          const fullImage = images.find((i) => i.id === id);
          const variant = fullImage?.variants?.find(
            (v) => v.name === "original",
          );
          const sizeVal = variant?.size;
          const numeric =
            typeof sizeVal === "bigint"
              ? Number(sizeVal)
              : typeof sizeVal === "string"
                ? Number(sizeVal)
                : sizeVal || 0;
          return acc + (Number.isFinite(numeric) ? numeric : 0);
        }, 0)}
        mediumQualitySize={Array.from(selectedIds).reduce((acc, id) => {
          const fullImage = images.find((i) => i.id === id);
          const variant = fullImage?.variants?.find((v) => v.name === "webp");
          const sizeVal = variant?.size;
          const numeric =
            typeof sizeVal === "bigint"
              ? Number(sizeVal)
              : typeof sizeVal === "string"
                ? Number(sizeVal)
                : sizeVal || 0;
          return acc + (Number.isFinite(numeric) ? numeric : 0);
        }, 0)}
      />

      {downloadProgress && (
        <DownloadProgress
          downloadId={downloadProgress.id}
          totalFiles={downloadProgress.totalFiles}
          onClose={() => setDownloadProgress(null)}
        />
      )}

    </div>
  );
}