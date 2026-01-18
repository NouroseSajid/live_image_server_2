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
  const [visibleCount, setVisibleCount] = useState(20);
  const [width, setWidth] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [lightboxImg, setLightboxImg] = useState<Image | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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
    const fetchImages = async () => {
      const res = await fetch("/api/images/repo");
      if (res.ok) {
        const data: FetchedImage[] = await res.json();
        setImages(data);
      } else {
        console.error("Failed to fetch images");
      }
    };
    fetchFolders();
    fetchImages();
  }, []);
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
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-blue-500/30 pb-24">
      {/* Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 border-b ${
          scrolled
            ? "bg-[#09090b]/80 backdrop-blur-xl border-zinc-800/50 py-3"
            : "bg-transparent border-transparent py-6"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <MdFolder className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Studio Archive
              </h1>
              <p className="text-xs text-zinc-500 font-medium">
                Internal Production Library
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-bold text-zinc-400 hover:text-white transition-all">
              <MdInfo size={16} />
              Help
            </button>
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden cursor-pointer hover:ring-2 ring-blue-500 transition-all">
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                alt="User"
              />
            </div>
          </div>
        </div>
      </header>

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

        {/* Pagination */}
        <LoadMoreButton
          visibleCount={visibleCount}
          totalCount={allImages.length}
          onLoadMore={() =>
            setVisibleCount((v) => Math.min(v + 20, allImages.length))
          }
        />
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
