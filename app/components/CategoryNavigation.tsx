"use client";
import { MdLock } from "react-icons/md";
import { useRef, useState } from "react";

interface Category {
  id: string;
  name: string;
  isPrivate?: boolean;
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
interface CategoryNavigationProps {
  categories: Category[];
  activeFolder: string;
  onSelectCategory: (category: string) => void;
  totalImages: number;
  selectedCount: number;
  onSelectAll: () => void;
}

export default function CategoryNavigation({
  categories,
  activeFolder,
  onSelectCategory,
  totalImages,
  selectedCount,
  onSelectAll,
}: CategoryNavigationProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const rafId = useRef<number | null>(null);
  const latestX = useRef(0);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    dragStartX.current = event.pageX;
    scrollStartX.current = scrollRef.current.scrollLeft;
    latestX.current = event.pageX;
    scrollRef.current.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollRef.current) return;
    event.preventDefault();
    latestX.current = event.pageX;
    if (rafId.current !== null) return;
    rafId.current = window.requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const delta = latestX.current - dragStartX.current;
      scrollRef.current.scrollLeft = scrollStartX.current - delta;
      rafId.current = null;
    });
  };

  const stopDragging = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && scrollRef.current) {
      scrollRef.current.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Folder Pills with Thumbnails */}
      <div
        ref={scrollRef}
        className={`flex gap-3 overflow-x-auto pb-3 folder-scrollbar select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${isDragging ? "" : "snap-x"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
      >
        {categories.map((cat) => {
          const thumbnailPath = cat.thumbnail?.variants?.[0]?.path;
          const isActive = activeFolder === cat.id;

          return (
            <button
              type="button"
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`group relative flex-shrink-0 rounded-lg overflow-hidden transition-all duration-300 snap-start border backdrop-blur-sm ${
                isActive
                  ? "border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.25)] scale-[1.02]"
                  : "border-white/10 hover:border-white/40"
              }`}
            >
              {/* Rectangle Thumbnail Container */}
              <div className="relative w-48 h-32 bg-gradient-to-br from-zinc-800 to-zinc-900 overflow-hidden">
                {/* Blurred Background Image */}
                {thumbnailPath && (
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-[2px] opacity-60 group-hover:opacity-80 transition-opacity duration-300"
                    style={{
                      backgroundImage: `url('${thumbnailPath}')`,
                    }}
                  />
                )}

                {/* Dark Gradient Overlay from Bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                {/* Active Badge */}
                {isActive && (
                  <div className="absolute top-2.5 left-2.5 z-20">
                    <div className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide text-white bg-gradient-to-r from-blue-500/90 to-cyan-400/90 shadow-lg">
                      Active
                    </div>
                  </div>
                )}

                {/* Lock Icon - Top Right */}
                {cat.isPrivate && (
                  <div className="absolute top-2.5 right-2.5 z-20">
                    <div className="p-1.5 bg-orange-500/90 rounded-lg backdrop-blur-sm shadow-lg">
                      <MdLock size={16} className="text-white" />
                    </div>
                  </div>
                )}

                {/* Bottom Info Bar */}
                <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5 flex items-end justify-between z-10">
                  {/* Folder Name - Left */}
                  <div className="min-w-0">
                    <p className="text-white text-lg font-semibold truncate leading-tight">
                      {cat.name}
                    </p>
                  </div>

                  {/* File Count - Right */}
                  {cat._count?.files !== undefined && (
                    <div className="ml-2 flex-shrink-0">
                      <p className="text-zinc-200 text-md font-medium whitespace-nowrap">
                        {cat._count.files}
                      </p>
                    </div>
                  )}
                </div>

                {/* Active Indicator Line */}
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-500" />
                )}

                {/* Active Glow Overlay */}
                {isActive && (
                  <div className="absolute inset-0 ring-2 ring-blue-400/50" />
                )}

                {/* Hover Effect */}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Select All */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/5"
        >
          {selectedCount === totalImages ? "Deselect All" : "Select All"}
        </button>
      </div>
    </div>
  );
}
