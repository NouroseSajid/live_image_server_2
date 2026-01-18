"use client";

interface LoadMoreButtonProps {
  visibleCount: number;
  totalCount: number;
  onLoadMore: () => void;
}

export default function LoadMoreButton({
  visibleCount,
  totalCount,
  onLoadMore,
}: LoadMoreButtonProps) {
  if (visibleCount >= totalCount) return null;

  return (
    <div className="flex flex-col items-center mt-16">
      <button
        onClick={onLoadMore}
        className="group relative px-12 py-4 bg-zinc-900 border border-zinc-800 text-white font-bold rounded-2xl transition-all overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        <span className="relative">Load More Assets</span>
      </button>
      <p className="mt-4 text-xs font-medium text-zinc-600">
        Showing {visibleCount} of {totalCount} images
      </p>
    </div>
  );
}
