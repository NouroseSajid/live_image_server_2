"use client";
import { MdLock } from "react-icons/md";

interface Category {
  id: string;
  name: string;
  isPrivate?: boolean;
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
    <div className="flex items-center justify-between mb-8">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
        {categories.map((cat) => (
          <button
            type="button"
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-5 py-2.5 rounded-full whitespace-nowrap snap-start border transition-all duration-500 ${
              activeFolder === cat.id
                ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.15)] scale-105 font-bold"
                : "bg-zinc-900/40 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
            }`}
          >
            <span className="inline-flex items-center gap-2 text-sm">
              {cat.isPrivate && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-md bg-white/10 border border-white/10 text-white/90">
                  <MdLock size={12} />
                  <span className="uppercase tracking-[0.12em] font-black text-[10px]">Lock</span>
                </span>
              )}
              <span>{cat.name}</span>
            </span>
            {cat._count?.files !== undefined && (
              <span className="ml-1.5 text-xs opacity-60">
                ({cat._count.files})
              </span>
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onSelectAll}
        className="hidden md:flex ml-6 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
      >
        {selectedCount === totalImages ? "Deselect All" : "Select All"}
      </button>
    </div>
  );
}
