"use client";
interface Category {
  id: string;
  name: string;
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
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-5 py-2.5 rounded-full whitespace-nowrap snap-start border transition-all duration-500 ${
              activeFolder === cat.id
                ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.15)] scale-105 font-bold"
                : "bg-zinc-900/40 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
            }`}
          >
            <span className="text-sm">{cat.name}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onSelectAll}
        className="hidden md:flex ml-6 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
      >
        {selectedCount === totalImages ? "Deselect All" : "Select All"}
      </button>
    </div>
  );
}
