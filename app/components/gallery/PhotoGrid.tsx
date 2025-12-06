"use client";

import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { Image as GalleryImage } from "@/app/types/gallery";
import { useSelection } from "@/app/hooks/useSelection";
import GalleryGridItem from "../GalleryGridItem";
import { CheckSquare, Square } from "lucide-react";

interface PhotoGridProps {
  images: GalleryImage[];
  newImageIds?: Set<string>;
}

export default function PhotoGrid({ images, newImageIds }: PhotoGridProps) {
  const [index, setIndex] = useState(-1);
  const { isImageSelected, toggleSelection } = useSelection();

  const currentImage = index >= 0 ? images[index] : null;
  const isSelected = currentImage ? isImageSelected(currentImage.id) : false;

  const SelectButton = (
    <button
      type="button"
      className="yarl__button"
      onClick={() => currentImage && toggleSelection(currentImage)}
      aria-label={isSelected ? "Deselect" : "Select"}
      style={{
        transform: "translateY(-2px)",
      }}
    >
      {isSelected ? <CheckSquare color="white" /> : <Square color="white" />}
    </button>
  );

  return (
    <>
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 p-4 space-y-4">
        {images.map((image, idx) => (
          <div key={image.id} className="break-inside-avoid">
            <GalleryGridItem
              image={image}
              index={idx}
              batchSize={20}
              onSelect={setIndex}
              isNew={newImageIds?.has(image.id) ?? false}
            />
          </div>
        ))}
      </div>

      <Lightbox
        slides={images.map((image) => {
          const webpVariant = image.variants.find((v) => v.name === "webp");
          const largeVariant = image.variants.find((v) => v.name === "large");
          return {
            src: largeVariant?.path || webpVariant?.path || "",
            width: image.width,
            height: image.height,
            alt: image.fileName,
          };
        })}
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        carousel={{
          finite: true,
        }}
        animation={{
          fade: 300,
        }}
        toolbar={{ buttons: [SelectButton, "close"] }}
        on={{ view: ({ index: currentIndex }) => setIndex(currentIndex) }}
        styles={{
          slide: {
            border: isSelected ? "4px solid #3b82f6" : "none",
            borderRadius: "8px",
          },
        }}
      />
    </>
  );
}
