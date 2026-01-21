"use client";

import ImageCard from "./ImageCard";

interface Image {
  id: string;
  width: number;
  height: number;
  url: string;
  category: string;
  title: string;
  meta: string;
}

interface LayoutItem {
  img: Image;
  w: number;
  h: number;
}

interface ImageGridProps {
  rows: LayoutItem[][];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenImage: (img: Image) => void;
}

export default function ImageGrid({
  rows,
  selectedIds,
  onToggleSelect,
  onOpenImage,
}: ImageGridProps) {
  const hasSelection = selectedIds.size > 0;
  return (
    <div className="space-y-[14px]">
      {rows.map((row, _rIdx) => {
        const rowKey = row.map((item) => item.img.id).join("-");
        return (
          <div key={rowKey} className="flex gap-[14px] justify-center">
            {row.map(({ img, w, h }) => (
              <ImageCard
                key={img.id}
                img={img}
                width={w}
                height={h}
                selected={selectedIds.has(img.id)}
                hasSelection={hasSelection}
                onToggle={() => onToggleSelect(img.id)}
                onOpen={onOpenImage}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
