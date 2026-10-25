"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import { resolveAssetPath } from "../lib/assets";
import { buildRows, type Image } from "../lib/imageData";
import { useFetch } from "../lib/useFetch";
import ActionBar from "./ActionBar";
import CategoryNavigation from "./CategoryNavigation";
import DownloadProgress from "./DownloadProgress";
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
interface IncomingFile {
  id: string;
  fileName: string;
  folderId: string;
  fileType: "image" | "video";
  mimeType?: string;
  variants?: { name: string; path: string; size?: number }[];
  width?: number;
  height?: number;
  createdAt?: string;
}

export interface Folder {
  id: string;
  name: string;
  isPrivate?: boolean;
  passphrase?: string | null;
  inGridView?: boolean;
  folderThumb?: string | null;
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
  initialFolder?: Folder;
}

export default function Gallery({
  initialFolderId,
  initialFolder,
}: GalleryProps = {}) {
  const [folders, setFolders] = useState<Folder[]>(
    initialFolder ? [initialFolder] : [],
  );
  const [activeFolder, setActiveFolder] = useState<string>(
    initialFolderId || "all",
  );

  useEffect(() => {
    if (initialFolderId && initialFolderId !== activeFolder) {
      setActiveFolder(initialFolderId);
    }
  }, [initialFolderId, activeFolder]);

  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [lightboxImg, setLightboxImg] = useState<Image | null>(null);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    id: string;
    totalFiles: number;
  } | null>(null);
  const [allFolderThumbnailUrl, setAllFolderThumbnailUrl] = useState<
    string | null
  >(null);
  const [folderMaxAgeMinutes, setFolderMaxAgeMinutes] = useState<
    Record<string, number | null>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [folderPassphrases, setFolderPassphrases] = useState<
    Record<string, string>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const sessionStored = sessionStorage.getItem("folderPassphrases");
      const localStored = localStorage.getItem("folderPassphrases");
      const session = sessionStored ? JSON.parse(sessionStored) : {};
      const local = localStored ? JSON.parse(localStored) : {};
      return { ...local, ...session };
    } catch {
      return {};
    }
  });
  const [passphraseModal, setPassphraseModal] = useState<{
    folderId: string;
    name: string;
  } | null>(null);
  const [passphraseError, setPassphraseError] = useState<string>("");
  const pendingAdvanceRef = useRef(false);
  const downloadCleanupRef = useRef<(() => void) | null>(null);
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

  const lightboxEntryRef = useRef(false);
  const ignoreLightboxPopRef = useRef(false);

  // Open the lightbox from the tap handler, not from an effect: mobile Safari
  // ignores history entries added without user activation when swiping back.
  // The #img= fragment gives the entry a distinct URL as well.
  const openLightbox = useCallback((img: Image) => {
    if (typeof window !== "undefined" && !lightboxEntryRef.current) {
      window.history.pushState(
        { lightboxOpen: true, imageId: img.id },
        "",
        `${window.location.pathname}${window.location.search}#img=${encodeURIComponent(img.id)}`,
      );
      lightboxEntryRef.current = true;
    }
    setLightboxImg(img);
  }, []);

  const showLightboxImage = useCallback((img: Image) => {
    if (typeof window !== "undefined" && lightboxEntryRef.current) {
      window.history.replaceState(
        { lightboxOpen: true, imageId: img.id },
        "",
        `${window.location.pathname}${window.location.search}#img=${encodeURIComponent(img.id)}`,
      );
    }
    setLightboxImg(img);
  }, []);

  const closeLightbox = useCallback(() => {
    pendingAdvanceRef.current = false;
    if (typeof window !== "undefined" && lightboxEntryRef.current) {
      lightboxEntryRef.current = false;
      ignoreLightboxPopRef.current = true;
      window.history.back();
    }
    setLightboxImg(null);
  }, []);

  // Browser back closes the lightbox instead of leaving the page.
  useEffect(() => {
    const handlePopState = () => {
      if (ignoreLightboxPopRef.current) {
        ignoreLightboxPopRef.current = false;
        return;
      }
      lightboxEntryRef.current = false;
      pendingAdvanceRef.current = false;
      if (window.location.hash.startsWith("#img=")) {
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${window.location.search}`,
        );
      }
      setLightboxImg(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Drop a stale #img= fragment left behind by a refresh while the lightbox was open.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.startsWith("#img=")) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, []);

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
      setPassphraseError("");
    },
    onError: setError,
  });

  const { sentinelRef, triggerLoadMore } = useInfiniteScroll({
    isLoading,
    hasMore,
    onLoadMore: () => setOffset((prev) => prev + BATCH_SIZE),
  });

  const { data: foldersData, error: foldersError } = useFetch<Folder[]>(
    "/api/folders?scope=public",
  );

  const { data: galleryConfigData } = useFetch<GalleryConfig>(
    "/api/gallery-config",
  );

  const { data: galleryOrderData } =
    useFetch<GalleryOrderItem[]>("/api/gallery-order");

  useEffect(() => {
    if (foldersData) {
      setFolders((prev) => {
        // Keep any folders that are already in state but not in foldersData
        // (e.g. folders added via initialFolder or tokens)
        const combined = [...foldersData];

        // Add initialFolder if missing
        if (initialFolder && !combined.some((f) => f.id === initialFolder.id)) {
          combined.push(initialFolder);
        }

        // Add any other "legacy" folders that were in prev but are not in combined
        prev.forEach((oldFolder) => {
          if (!combined.some((f) => f.id === oldFolder.id)) {
            combined.push(oldFolder);
          }
        });

        return combined;
      });
    }
    if (foldersError) {
      setError("Failed to load folders. Retrying automatically...");
    }
  }, [foldersData, foldersError, initialFolder]);

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
          if (data.folder) {
            setFolders((prev) => {
              if (prev.some((f) => f.id === data.folder.id)) return prev;
              return [...prev, data.folder];
            });
          }
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
      sessionStorage.setItem(
        "folderPassphrases",
        JSON.stringify(folderPassphrases),
      );
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
              const newFile: IncomingFile = message.payload;
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
                  newFile.variants?.find((v) => v.name === "thumbnail")?.path ||
                  newFile.variants?.find((v) => v.name === "thumb")?.path ||
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
            console.error(
              "[Gallery] Error processing WebSocket message:",
              error,
            );
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

  // Clean up any active download SSE/polling on unmount (memory leak prevention)
  useEffect(() => {
    return () => {
      if (downloadCleanupRef.current) {
        downloadCleanupRef.current();
        downloadCleanupRef.current = null;
      }
    };
  }, []);

  const lastResetFolderRef = useRef(activeFolder);
  useEffect(() => {
    if (lastResetFolderRef.current === activeFolder) return;
    lastResetFolderRef.current = activeFolder;
    setOffset(0);
    setSelectedIds(new Set());
  }, [activeFolder]);

  // Handle #hash scroll after hydration (e.g. #latest-uploads)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const id = hash.slice(1);
    const scrollToHash = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return true;
      }
      return false;
    };
    // Try immediately, then retry after a short delay for layout settling
    if (!scrollToHash()) {
      const timer = setTimeout(scrollToHash, 300);
      return () => clearTimeout(timer);
    }
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

      const convertToApiRoute = (dbPath?: string) =>
        resolveAssetPath(dbPath) ?? undefined;

      const videoUrl = isVideo
        ? convertToApiRoute(originalVariant?.path) ||
          convertToApiRoute(image.variants[0]?.path)
        : undefined;

      const thumbnailUrl = isVideo
        ? convertToApiRoute(thumbnailVariant?.path) ||
          "/icons/video-placeholder.svg"
        : convertToApiRoute(thumbnailVariant?.path) ||
          convertToApiRoute(image.variants[0]?.path) ||
          "/icons/video-placeholder.svg";

      const lightboxUrl =
        convertToApiRoute(webpVariant?.path) ||
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

  const scrollToImage = useCallback((id: string) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(`image-${id}`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === processedImages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedImages.map((i) => i.id)));
    }
  };

  const categories = useMemo(() => {
    // The "All" card falls back to the first folder that has a thumbnail
    // when no gallery-wide thumbnail has been configured.
    let fallbackAllThumbnail = allFolderThumbnailUrl;
    if (!fallbackAllThumbnail) {
      for (const folder of folders) {
        const thumb =
          folder.folderThumb || folder.thumbnail?.variants?.[0]?.path || null;
        if (thumb) {
          fallbackAllThumbnail = thumb;
          break;
        }
      }
    }
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

  useEffect(() => {
    if (!pendingAdvanceRef.current || !lightboxImg) return;
    if (isLoading) return;
    const idx = processedImages.findIndex((i) => i.id === lightboxImg.id);
    if (idx === -1) {
      if (!hasMore) pendingAdvanceRef.current = false;
      return;
    }
    const next = processedImages[idx + 1];
    if (next) {
      pendingAdvanceRef.current = false;
      showLightboxImage(next);
      scrollToImage(next.id);
      return;
    }
    if (!hasMore) {
      pendingAdvanceRef.current = false;
    }
  }, [
    processedImages,
    lightboxImg,
    hasMore,
    isLoading,
    showLightboxImage,
    scrollToImage,
  ]);

  useEffect(() => {
    if (!lightboxImg || isLoading || !hasMore) return;
    const idx = processedImages.findIndex((i) => i.id === lightboxImg.id);
    if (idx === -1) return;
    if (processedImages.length - 1 - idx <= 3) {
      triggerLoadMore();
    }
  }, [processedImages, lightboxImg, isLoading, hasMore, triggerLoadMore]);
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

        <div
          id="latest-uploads"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 scroll-mt-24"
        >
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
          onOpenImage={openLightbox}
        />

        <div ref={sentinelRef} className="h-4" />

        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--foreground)]/60"></div>
            <span className="ml-3 text-[var(--foreground)]/60">
              Loading more images...
            </span>
          </div>
        )}

        {!hasMore && processedImages.length > 0 && (
          <div className="text-center py-8 text-[var(--foreground)]/60">
            <p>No more images to load</p>
          </div>
        )}
      </main>

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
              window.history.replaceState(
                {},
                "",
                `?f=${passphraseModal.folderId}`,
              );
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

      {lightboxImg &&
        (() => {
          const idx = processedImages.findIndex((i) => i.id === lightboxImg.id);
          const hasImages = processedImages.length > 0 && idx !== -1;
          const nextImage =
            hasImages && idx + 1 < processedImages.length
              ? processedImages[idx + 1]
              : null;
          const prevImage =
            hasImages && idx - 1 >= 0 ? processedImages[idx - 1] : null;

          return (
            <Lightbox
              image={lightboxImg}
              passphrase={folderPassphrases[activeFolder]}
              onClose={closeLightbox}
              onNext={() => {
                const idx = processedImages.findIndex(
                  (i) => i.id === lightboxImg.id,
                );
                const next = idx + 1;
                if (next < processedImages.length) {
                  showLightboxImage(processedImages[next]);
                  scrollToImage(processedImages[next].id);
                  return;
                }
                if (hasMore && !isLoading) {
                  pendingAdvanceRef.current = true;
                  triggerLoadMore();
                }
              }}
              onPrev={() => {
                const idx = processedImages.findIndex(
                  (i) => i.id === lightboxImg.id,
                );
                const prev = idx - 1;
                if (prev >= 0) {
                  showLightboxImage(processedImages[prev]);
                  scrollToImage(processedImages[prev].id);
                }
              }}
              canNext={Boolean(nextImage) || (hasMore && !isLoading)}
              isLoadingMore={isLoading}
              nextImage={nextImage}
              prevImage={prevImage}
              isSelected={selectedIds.has(lightboxImg.id)}
              onToggleSelect={toggleSelect}
              isDownloading={isDownloading}
            />
          );
        })()}

      {!downloadProgress && (
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
      )}

      <QualityModal
        isOpen={showQualityModal}
        onSelect={async (quality) => {
          setShowQualityModal(false);
          setIsDownloading(true);
          setError(null);

          try {
            const downloadId = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            console.log(
              `[Download] Starting download of ${selectedIds.size} images (quality: ${quality}, id: ${downloadId})`,
            );

            setDownloadProgress({
              id: downloadId,
              totalFiles: selectedIds.size,
            });

            // Shared completion resolver — clears selection, unlocks the UI,
            // and hides the progress toast after a short delay. Used by the
            // SSE listener, the polling fallback, and the unmount cleanup so
            // every resolution path behaves identically. The SSE connection
            // is created only AFTER the session POST succeeds so a failed
            // POST cannot leak an open EventSource.
            let sseResolved = false;
            let pollInterval: NodeJS.Timeout | null = null;
            let eventSource: EventSource | null = null;
            const resolveDownload = () => {
              if (sseResolved) return;
              sseResolved = true;
              if (pollInterval) clearInterval(pollInterval);
              if (eventSource) eventSource.close();
              setSelectedIds(new Set());
              setError(null);
              setIsDownloading(false);
              setTimeout(() => setDownloadProgress(null), 3000);
            };

            // Step 1: Create a download session via POST
            const res = await fetch("/api/images/download-zip", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageIds: Array.from(selectedIds),
                quality,
                downloadId,
                passphrase: folderPassphrases[activeFolder] || "",
              }),
            });

            if (!res.ok) {
              const errorData = await res
                .json()
                .catch(() => ({ error: "Unknown error" }));
              throw new Error(
                errorData.error || `Server returned ${res.status}`,
              );
            }

            const { sessionToken } = await res.json();
            console.log(`[Download] Session created: ${sessionToken}`);

            // Set up SSE listener for completion — the completion event can
            // only arrive once the download stream ends, so connecting here
            // (after the POST, before link.click) loses nothing.
            eventSource = new EventSource("/api/events");
            eventSource.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);
                if (
                  msg.type === "download-complete" &&
                  msg.payload.downloadId === downloadId
                ) {
                  console.log(
                    "[Download] Received completion event from server",
                  );
                  resolveDownload();
                }
              } catch (err) {
                console.error("[Download] SSE parse error:", err);
              }
            };
            eventSource.onerror = () => {
              console.warn(
                "[Download] SSE connection failed — will rely on polling fallback",
              );
            };

            // Step 2: Trigger the actual download via <a> tag click.
            // This is the most iOS-friendly approach:
            //   - No popup blocker (it's a direct DOM click, not window.open)
            //   - No page navigation (unlike form.submit)
            //   - SSE connection on the main page stays alive for progress
            const downloadUrl = `/api/images/download-zip/${sessionToken}`;
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = "";
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Step 3: Polling fallback — if SSE fails to deliver the
            // completion event (common on iOS when tabs are backgrounded),
            // poll every 3 seconds. A 404 means the session was deleted:
            // download finished, browser download canceled, or the server
            // stream errored/timed out. We poll longer than the server's
            // 15-minute download timeout so every terminal state resolves.
            let pollAttempts = 0;
            const maxPollAttempts = 340; // ~17 minutes
            pollInterval = setInterval(() => {
              pollAttempts++;
              if (sseResolved) return;
              if (pollAttempts >= maxPollAttempts) {
                // Never confirmed — release the UI rather than hanging forever.
                console.warn(
                  "[Download] Polling exhausted without confirmation — releasing UI",
                );
                resolveDownload();
                return;
              }
              fetch(`/api/images/download-zip/status/${sessionToken}`)
                .then((r) => {
                  if (!r.ok && !sseResolved) {
                    // 404: session gone — download completed or was canceled
                    console.log("[Download] Status 404 — session finished");
                    resolveDownload();
                  }
                })
                .catch(() => {
                  // Network error — don't assume completion, just wait
                });
            }, 3000);

            // If SSE completed while the interval was being set up, stop it now.
            if (sseResolved && pollInterval) {
              clearInterval(pollInterval);
            }

            // Store cleanup so it runs on unmount (memory leak prevention)
            downloadCleanupRef.current = () => {
              resolveDownload();
            };
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : "Unknown error";
            console.error("[Download] Exception:", errorMsg, error);

            setDownloadProgress(null);
            setError(`Download failed to start: ${errorMsg}`);
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
