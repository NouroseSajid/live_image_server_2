export const CATEGORIES = [
  "Nature",
  "Architecture",
  "Travel",
  "Portraits",
  "Street",
  "Food",
  "Events",
  "Studio",
  "Weddings",
  "Products",
  "Sports",
  "Night",
  "Abstract",
];

export interface Image {
  id: string;
  width: number;
  height: number;
  url: string; // thumbnail for gallery
  originalUrl?: string; // original quality for lightbox
  thumbnailUrl?: string;
  videoUrl?: string;
  mimeType?: string;
  isVideo?: boolean;
  category: string;
  title: string;
  meta: string;
}

export interface LayoutItem {
  img: Image;
  w: number;
  h: number;
}

export const buildRows = (
  images: Image[],
  containerWidth: number,
  targetRowHeight: number = 280,
  gap: number = 14,
): LayoutItem[][] => {
  if (!containerWidth || containerWidth <= 0) return [];

  const rows: LayoutItem[][] = [];
  let currentRow: Image[] = [];
  let currentAspectSum = 0;

  images.forEach((img) => {
    const aspect = img.width / img.height;
    currentRow.push(img);
    currentAspectSum += aspect;

    const rowWidthWithoutGaps = currentAspectSum * targetRowHeight;
    const totalGaps = (currentRow.length - 1) * gap;

    if (rowWidthWithoutGaps + totalGaps >= containerWidth) {
      const height = (containerWidth - totalGaps) / currentAspectSum;
      rows.push(
        currentRow.map((i) => ({
          img: i,
          w: height * (i.width / i.height),
          h: height,
        })),
      );
      currentRow = [];
      currentAspectSum = 0;
    }
  });

  if (currentRow.length) {
    rows.push(
      currentRow.map((i) => ({
        img: i,
        w: targetRowHeight * (i.width / i.height),
        h: targetRowHeight,
      })),
    );
  }

  return rows;
};
