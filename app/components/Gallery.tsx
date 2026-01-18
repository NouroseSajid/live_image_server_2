"use client";
import { useEffect, useRef, useMemo, useState } from "react";
import { MdFolder, MdInfo } from "react-icons/md";
import ImageCard from "./ImageCard";
import Lightbox from "./Lightbox";
import CategoryNavigation from "./CategoryNavigation";
import ActionBar from "./ActionBar";
import ImageGrid from "./ImageGrid";
import LoadMoreButton from "./LoadMoreButton";
import QualityModal from "./QualityModal";
import { buildRows, type Image } from "../lib/imageData";
interface FetchedImage {
  id: string;
  fileName: string;
  folderId: string;
  variants: {
    path: string;
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
}
export default function Gallery() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [images, setImages] = useState<FetchedImage[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [width, setWidth] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [lightboxImg, setLightboxImg] = useState<Image | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const BATCH_SIZE = 20;
  useEffect(() => {
    const fetchFolders = async () => {
      const res = await fetch("/api/folders");
      if (res.ok) {
        const data: Folder[] = await res.json();
        setFolders(data);
      } else {
        console.error("Failed to fetch folders");
      }
    };
    fetchFolders();
  }, []);

  // Fetch initial batch and new batches as offset changes
  useEffect(() => {
    const fetchImages = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/images/repo?limit=${BATCH_SIZE}&offset=${offset}`);
        if (res.ok) {
          const data: FetchedImage[] = await res.json();
          if (offset === 0) {
            setImages(data);
          } else {
            setImages((prev) => [...prev, ...data]);
          }
          setHasMore(data.length === BATCH_SIZE);
        } else {
          console.error("Failed to fetch images");
        }
      } catch (error) {
        console.error("Error fetching images:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchImages();
  }, [offset, activeFolder]);

  // Infinite scroll detection using Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          setOffset((prev) => prev + BATCH_SIZE);
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
Offset(0);
    setImages([]);
    setSelectedIds(new Set());
    setHasMore(true
      observer.disconnect();
    };
  }, [isLoading, hasMore]);
  const allImages = useMemo(() => {
    const processedImages = images.map((image) => ({
      id: image.id,
      width: image.width,
      height: image.height,
      url: image.variants[0]?.path || "/placeholder-image.jpg",
      category: image.folderId,
      title: image.fileName,
      meta: `${image.width}x${image.height}`,
    }));
    if (activeFolder === "all") {
      return processedImages;
    }
    return processedImages.filter((image) => image.category === activeFolder);
  }, [images, activeFolder]);
  const pageImages = useMemo(
    () => allImages.slice(0, visibleCount),
    [allImages, visibleCount]
  );
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
  useEffect(() => {
    setVisibleCount(20);
    setSelectedIds(new Set());
  }, [activeFolder]);
  const rows = useMemo(
    () => buildRows(pageImages, width, 260, 14),
    [pageImages, width]
  );
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const handleSelectAll = () => {
    if (selectedIds.size === allImages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allImages.map((i) => i.id)));
    }
  };
  const categories = useMemo(() => {
    return [{ id: "all", name: "All" }, ...folders];
  }, [folders]);
  return (
    <div className="min-h-screen bg-transparent text-zinc-100 font-sans selection:bg-blue-500/30 pb-24">
      {/* Header */}
      

      <main ref={containerRef} className="max-w-[1400px] mx-auto px-6 mt-8">
        {/* Category Navigation */}
        <CategoryNavigation
          categories={categories}
          activeFolder={activeFolder}
          onSelectCategory={setActiveFolder}
          totalImages={allImages.length}
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
        {!hasMore && allImages.length > 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No more images to load</p>
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {lightboxImg && (
        <Lightbox
          img={lightboxImg}
          onClose={() => setLightboxImg(null)}
          onNext={() => {
            const idx = allImages.findIndex((i) => i.id === lightboxImg.id);
            setLightboxImg(allImages[(idx + 1) % allImages.length]);
          }}
          onPrev={() => {
            const idx = allImages.findIndex((i) => i.id === lightboxImg.id);
            setLightboxImg(
              allImages[(idx - 1 + allImages.length) % allImages.length]
            );
          }}
        />
      )}

      {/* Contextual Action Bar */}
      <ActionBar
        selectedCount={selectedIds.size}
        selectedIds={selectedIds}
        mediumQualitySize={allImages
          .filter(img => selectedIds.has(img.id))
          .reduce((acc, img) => {
            const fullImage = images.find(i => i.id === img.id);
            const variant = fullImage?.variants?.find(v => v.name === 'webp');
            return acc + (variant?.size || BigInt(0));
          }, BigInt(0)) // Start with BigInt(0)
        }
        onClear={() => setSelectedIds(new Set())}
        onDownloadAll={async () => {
          if (selectedIds.size === 0) {
            alert("Please select images to download.");
            return;
          }

          setShowQualityModal(true);
        }}
        onShare={() => {
          // Share functionality
          const selectedList = Array.from(selectedIds).join(',');
          const shareUrl = `${window.location.origin}?selected=${selectedList}`;
          navigator.clipboard.writeText(shareUrl);
          alert('Shared URL copied to clipboard!');
        }}
      />

      {/* Quality Selection Modal */}
      <QualityModal
        isOpen={showQualityModal}
        onSelect={async (quality) => {
          setShowQualityModal(false);
          setIsDownloading(true);

          try {
            const response = await fetch('/api/images/download-zip', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ imageIds: Array.from(selectedIds), quality }),
            });

            if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'selected_images.zip';
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              a.remove();
              // Clear selection after download initiated
              setSelectedIds(new Set());
              alert("Your download has started! For iOS users, you can find the ZIP file in your 'Files' app, usually under 'Downloads' or 'On My iPhone/iPad'.");
            } else {
              const errorData = await response.json();
              alert(`Failed to download images: ${errorData.error || response.statusText}`);
            }
          } catch (error) {
            console.error('Error initiating zip download:', error);
            alert('An unexpected error occurred during download.');
          } finally {
            setIsDownloading(false);
          }
        }}
        onCancel={() => setShowQualityModal(false)}
        highQualitySize={allImages
          .filter(img => selectedIds.has(img.id))
          .reduce((acc, img) => {
            const fullImage = images.find(i => i.id === img.id);
            const variant = fullImage?.variants?.find(v => v.name === 'original');
            return acc + (variant?.size || 0);
          }, 0)
        }
        mediumQualitySize={allImages
          .filter(img => selectedIds.has(img.id))
          .reduce((acc, img) => {
            const fullImage = images.find(i => i.id === img.id);
            const variant = fullImage?.variants?.find(v => v.name === 'webp');
            return acc + (variant?.size || 0);
          }, 0)
        }
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
