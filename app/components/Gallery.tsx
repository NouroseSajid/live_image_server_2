"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import { buildRows, type Image } from "../lib/imageData";
import { useFetch } from "../lib/useFetch";
import ActionBar from "./ActionBar";
import CategoryNavigation from "./CategoryNavigation";
import DownloadProgress from "./DownloadProgress";
import ImageGrid from "./ImageGrid";
import Lightbox from "./Lightbox";
import QualityModal from "./QualityModal";

interface FetchedImage {
  id: string;
  fileName: string;
  folderId: string;
  fileType: "image" | "video";
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
}
interface Folder {
  id: string;
  name: string;
  isPrivate?: boolean;
  passphrase?: string | null;
  inGridView?: boolean;
  _count?: {
    files: number;
  };
}

interface GalleryProps {
  initialFolderId?: string;
}

export default function Gallery({ initialFolderId }: GalleryProps = {}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [images, setImages] = useState<FetchedImage[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>(initialFolderId || "all");
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [width, setWidth] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [lightboxImg, setLightboxImg] = useState<Image | null>(null);
  const [_scrolled, setScrolled] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [_isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    id: string;
    totalFiles: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderPassphrases, setFolderPassphrases] = useState<Record<string, string>>({});
  const [passphraseModal, setPassphraseModal] = useState<{
    folderId: string;
    name: string;
  } | null>(null);
  const [passphraseInput, setPassphraseInput] = useState("");
  const [passphraseError, setPassphraseError] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const BATCH_SIZE = 20;
  const _ROW_HEIGHT = 260;
  const _ROW_GAP = 14;
  const _RESIZE_DEBOUNCE = 200;

  // Fetch folders with SWR (auto-retry, caching, revalidation)
  const { data: foldersData, error: foldersError } =
    useFetch<Folder[]>("/api/folders");

  // Update local state when SWR data changes
  useEffect(() => {
    if (foldersData) {
      setFolders(foldersData);
    }
    if (foldersError) {
      setError("Failed to load folders. Retrying automatically...");
    }
  }, [foldersData, foldersError]);

  // Parse URL params and restore passphrase/token state from storage or URL
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const folderParam = params.get("f");
    const passphraseParam = params.get("p");
    const tokenParam = params.get("t") || params.get("token");

    // Restore from sessionStorage (set by /f/[slug] page)
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

    // Token flow: validate and set cookie, then activate folder
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

    // If folder param in URL, auto-select it
    if (folderParam) {
      applyFolder(folderParam);

      // If passphrase in URL, add it to state and clean the URL
      if (passphraseParam) {
        setFolderPassphrases((prev) => ({
          ...prev,
          [folderParam]: decodeURIComponent(passphraseParam),
        }));
        window.history.replaceState({}, "", `?f=${folderParam}`);
      }
    }
  }, []);

  // Hydrate stored passphrases from localStorage (per-folder caching)
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

  // Persist passphrases when they change
  useEffect(() => {
    try {
      localStorage.setItem("folderPassphrases", JSON.stringify(folderPassphrases));
    } catch (err) {
      console.error("[Gallery] Failed to persist passphrases", err);
    }
  }, [folderPassphrases]);

  // WebSocket connection for live updates
  useEffect(() => {
    let ws: WebSocket | null = null;

    const connectWebSocket = async () => {
      try {
        // Fetch the WebSocket URL from config endpoint
        const configRes = await fetch("/api/config");
        const config = await configRes.json();
        const wsUrl = config.wsUrl || "ws://localhost:8080";

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[Gallery] Connected to WebSocket server at", wsUrl);
        };

        ws.onmessage = async (event) => {
          try {
            // Handle both string and Blob messages (Cloudflare Tunnel sends Blobs)
            let data = event.data;
            if (data instanceof Blob) {
              data = await data.text();
            }
            
            const message = JSON.parse(data);
            if (message.type === "new-file" && message.payload) {
              const newFile = message.payload;
              console.log("[Gallery] Received new file:", newFile.fileName);
              
              // Transform the file to match our FetchedImage format
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
              };

              // Add to the beginning of images array (newest first)
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
  }, []);

  // Fetch initial batch and new batches as offset changes
  useEffect(() => {
    const fetchImages = async () => {
      // Don't fetch if passphrase modal is open - prevents infinite loop
      if (passphraseModal) {
        return;
      }

      setIsLoading(true);
      try {
        const currentFolder = folders.find((f) => f.id === activeFolder);
        const pass =
          activeFolder !== "all" && currentFolder?.isPrivate
            ? folderPassphrases[activeFolder]
            : undefined;
        const passQuery = pass ? `&passphrase=${encodeURIComponent(pass)}` : "";
        const folderQuery =
          activeFolder !== "all" ? `&folderId=${activeFolder}` : "";
        const res = await fetch(
          `/api/images/repo?limit=${BATCH_SIZE}&offset=${offset}${folderQuery}${passQuery}`,
        );
        if (res.ok) {
          const data: FetchedImage[] = await res.json();
          if (offset === 0) {
            setImages(data);
          } else {
            setImages((prev) => [...prev, ...data]);
          }
          setHasMore(data.length === BATCH_SIZE);
        } else if (res.status === 401 || res.status === 403) {
          setError("Passphrase required or invalid for this folder.");
          setFolderPassphrases((prev) => {
            const next = { ...prev };
            delete next[activeFolder];
            return next;
          });
          const folder = folders.find((f) => f.id === activeFolder);
          if (folder && !passphraseModal) {
            setPassphraseModal({ folderId: folder.id, name: folder.name });
            setPassphraseInput("");
            setPassphraseError("Passphrase required");
          }
        } else {
          setError("Failed to load images. Please try again.");
        }
      } catch (_err) {
        setError("Network error loading images. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, [offset, activeFolder, folders, folderPassphrases, passphraseModal]);

  // Infinite scroll detection using Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          setOffset((prev) => prev + BATCH_SIZE);
        }
      },
      { threshold: 0.1 },
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [isLoading, hasMore]);

  // Reset when changing folder
  useEffect(() => {
    setOffset(0);
    setImages([]);
    setSelectedIds(new Set());
    setHasMore(true);
  }, [activeFolder]);

  // Handle resize for responsive layout
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    const handleResize = () =>
      containerRef.current && setWidth(containerRef.current.offsetWidth);
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Filter images by folder
  const filteredImages = useMemo(
    () =>
      activeFolder === "all"
        ? images
        : images.filter((i) => i.folderId === activeFolder),
    [images, activeFolder],
  );

  // Transform raw images to processed format for buildRows
  const processedImages = useMemo(() => {
    return filteredImages.map((image) => {
      const isVideo = image.fileType === "video";
      const thumbnailVariant =
        image.variants.find((v) => v.name === "thumbnail") ||
        image.variants.find((v) => v.name === "thumb");
      
      const webpVariant = image.variants.find((v) => v.name === "webp");
      const originalVariant = image.variants.find((v) => v.name === "original");

      // Convert database paths to API route URLs
      // Database paths are like: /images/folderId/thumbs/filename.webp
      // We need to convert to: /api/serve/folderId/thumbs/filename.webp
      const convertToApiRoute = (dbPath?: string) => {
        if (!dbPath) return dbPath;
        if (dbPath.startsWith("/icons/")) return dbPath; // Keep placeholder icons as-is
        
        // Replace /images/ with /api/serve/
        return dbPath.replace(/^\/images\//, "/api/serve/");
      };

      const thumbnailUrl = isVideo 
        ? "/icons/video-placeholder.svg"
        : convertToApiRoute(thumbnailVariant?.path) || convertToApiRoute(image.variants[0]?.path) || "/icons/video-placeholder.svg";
      
      const lightboxUrl = convertToApiRoute(webpVariant?.path) ||
        convertToApiRoute(originalVariant?.path) ||
        convertToApiRoute(image.variants[0]?.path) ||
        "/icons/video-placeholder.svg";

      return {
        id: image.id,
        width: image.width ?? 1920,
        height: image.height ?? 1080,
        // Use compressed thumbnail for grid via API route (bypasses Next.js caching)
        url: thumbnailUrl,
        // Prefer webp for lightbox display; fall back to original
        originalUrl: lightboxUrl,
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

  const closePassphraseModal = () => {
    setPassphraseModal(null);
    setPassphraseError("");
    setPassphraseInput("");
  };

  const submitPassphrase = () => {
    if (!passphraseModal) return;
    if (!passphraseInput.trim()) {
      setPassphraseError("Passphrase required");
      return;
    }
    setFolderPassphrases((prev) => ({
      ...prev,
      [passphraseModal.folderId]: passphraseInput.trim(),
    }));
    setActiveFolder(passphraseModal.folderId);
    // Update URL after successful passphrase
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `?f=${passphraseModal.folderId}`);
    }
    setError(null);
    closePassphraseModal();
  };

  const categories = useMemo(() => {
    return [{ id: "all", name: "All" }, ...folders];
  }, [folders]);

  const handleSelectCategory = (folderId: string) => {
    if (folderId === "all") {
      setActiveFolder(folderId);
      // Update URL to home
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
        // Update URL with folder slug
        if (typeof window !== "undefined" && folder) {
          window.history.replaceState({}, "", `?f=${folder.id}`);
        }
        return;
      }
      setPassphraseModal({ folderId, name: folder.name });
      setPassphraseInput("");
      setPassphraseError("Enter passphrase to unlock");
      return;
    }

    setActiveFolder(folderId);
    // Update URL with folder slug
    if (typeof window !== "undefined" && folder) {
      window.history.replaceState({}, "", `?f=${folder.id}`);
    }
  };
  return (
    <div className="min-h-screen bg-transparent text-zinc-100 font-sans selection:bg-blue-500/30 pb-24">
      {/* Header */}

      <main ref={containerRef} className="max-w-[1400px] mx-auto px-6 mt-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-3">
            <MdInfo className="text-xl flex-shrink-0" />
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-red-300 hover:text-red-100 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* Category Navigation */}
        <CategoryNavigation
          categories={categories}
          activeFolder={activeFolder}
          onSelectCategory={handleSelectCategory}
          totalImages={processedImages.length}
          selectedCount={selectedIds.size}
          onSelectAll={handleSelectAll}
        />

        {/* The Grid */}
        <ImageGrid
          rows={rows}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpenImage={setLightboxImg}
        />

        {/* Infinite Scroll Sentinel */}
        <div ref={sentinelRef} className="h-4" />

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-400">Loading more images...</span>
          </div>
        )}

        {/* No More Images Message */}
        {!hasMore && processedImages.length > 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No more images to load</p>
          </div>
        )}
      </main>

      {/* Passphrase Modal */}
      {passphraseModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closePassphraseModal}
          />
          <div className="relative w-full max-w-md bg-zinc-900/90 border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] p-6 sm:p-7 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/30">
                🔒
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm uppercase tracking-[0.15em] text-zinc-500 font-black mb-1">
                  Private Folder
                </p>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {passphraseModal.name}
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Enter the passphrase to view this folder and its images.
                </p>
              </div>
              <button
                type="button"
                onClick={closePassphraseModal}
                className="p-2 rounded-full hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"
                aria-label="Close passphrase dialog"
              >
                ✕
              </button>
            </div>

            <div className="mt-5">
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500 block mb-2">
                Passphrase
              </label>
              <input
                type="password"
                value={passphraseInput}
                onChange={(e) => {
                  setPassphraseInput(e.target.value);
                  setPassphraseError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitPassphrase();
                }}
                className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition"
                placeholder="Enter passphrase"
                autoFocus
              />
              {passphraseError && (
                <p className="text-xs text-red-400 mt-2">{passphraseError}</p>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={submitPassphrase}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-blue-500 text-white font-bold uppercase text-xs tracking-[0.14em] hover:bg-blue-400 active:scale-[0.99] transition shadow-lg shadow-blue-500/30"
              >
                Unlock Folder
              </button>
              <button
                type="button"
                onClick={closePassphraseModal}
                className="w-full sm:w-auto px-5 py-3 rounded-xl border border-white/10 text-zinc-300 font-bold uppercase text-xs tracking-[0.14em] hover:border-white/30 hover:text-white active:scale-[0.99] transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        (() => {
          const idx = processedImages.findIndex((i) => i.id === lightboxImg.id);
          const hasImages = processedImages.length > 0 && idx !== -1;
          const nextImage = hasImages
            ? processedImages[(idx + 1) % processedImages.length]
            : null;
          const prevImage = hasImages
            ? processedImages[(idx - 1 + processedImages.length) % processedImages.length]
            : null;

          return (
        <Lightbox
          image={lightboxImg}
          onClose={() => setLightboxImg(null)}
          onNext={() => {
            const idx = processedImages.findIndex(
              (i) => i.id === lightboxImg.id,
            );
            setLightboxImg(processedImages[(idx + 1) % processedImages.length]);
          }}
          onPrev={() => {
            const idx = processedImages.findIndex(
              (i) => i.id === lightboxImg.id,
            );
            setLightboxImg(
              processedImages[
                (idx - 1 + processedImages.length) % processedImages.length
              ],
            );
          }}
          nextImage={nextImage}
          prevImage={prevImage}
          isSelected={selectedIds.has(lightboxImg.id)}
          onToggleSelect={toggleSelect}
        />
          );
        })()
      )}

      {/* Contextual Action Bar */}
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
      />

      {/* Quality Selection Modal */}
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
              signal: AbortSignal.timeout(20 * 60 * 1000), // 20 minute client timeout
            });

            console.log(
              `[Download] Response received: status=${response.status}`,
            );

            // Get download ID from response headers
            const downloadId = response.headers.get("X-Download-ID") || `dl-${Date.now()}`;
            
            // Show progress UI
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

            // Check content type
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

            // Validate blob size
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

            // Cleanup
            setTimeout(() => {
              window.URL.revokeObjectURL(url);
              a.remove();
            }, 100);

            // Clear selection after download initiated
            setSelectedIds(new Set());
            setError(null);
            setShowQualityModal(false);

            const sizeStr = (blob.size / 1024 / 1024).toFixed(1);
            
            console.log(
              `[Download] Success! File size: ${sizeStr}MB`,
            );

            // Keep progress UI visible for 2 seconds after completion
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

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
