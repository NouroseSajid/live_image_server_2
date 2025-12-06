"use client";

import { createContext, useState, ReactNode, useMemo } from "react";
import { Image } from "@/app/types/gallery";

interface SelectionContextType {
  selectedImages: Image[];
  toggleSelection: (image: Image) => void;
  isImageSelected: (imageId: string) => boolean;
  clearSelection: () => void;
}

export const SelectionContext = createContext<SelectionContextType | undefined>(
  undefined,
);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedImages, setSelectedImages] = useState<Image[]>([]);

  const toggleSelection = (image: Image) => {
    setSelectedImages((prevSelected) => {
      const isSelected = prevSelected.some(
        (selectedImage) => selectedImage.id === image.id,
      );
      if (isSelected) {
        return prevSelected.filter(
          (selectedImage) => selectedImage.id !== image.id,
        );
      } else {
        return [...prevSelected, image];
      }
    });
  };

  const isImageSelected = (imageId: string): boolean => {
    return selectedImages.some((image) => image.id === imageId);
  };

  const clearSelection = () => {
    setSelectedImages([]);
  };

  const value = useMemo(
    () => ({
      selectedImages,
      toggleSelection,
      isImageSelected,
      clearSelection,
    }),
    [selectedImages],
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}
