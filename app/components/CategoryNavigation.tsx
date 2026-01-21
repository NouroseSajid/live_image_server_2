"use client";
import { MdLock } from "react-icons/md";

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
  return (
    <div className="space-y-4 mb-8">
      {/* Folder Pills with Thumbnails */}
      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide snap-x">
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
                  ? "border-white/60 shadow-lg shadow-white/20"
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
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-white/80 via-white/60 to-white/20" />
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
