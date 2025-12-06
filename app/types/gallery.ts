export interface ImageVariant {
  name: string;
  path: string;
}

export interface Image {
  id: string;
  fileName: string;
  folderId: string;
  width: number;
  height: number;
  variants: ImageVariant[];
  isProcessing?: boolean;
  processingProgress?: number;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  folderThumb: string | null;
  uniqueUrl: string;
  isPrivate?: boolean;
}

export interface ProcessingImage {
  id: string;
  fileName: string;
  progress: number;
}
