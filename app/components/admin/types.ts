export interface Folder {
  id: string;
  name: string;
  uniqueUrl: string;
  isPrivate: boolean;
  visible: boolean;
  archived: boolean;
  passphrase: string | null;
  inGridView: boolean;
  folderThumb: string | null;
  groupId?: string | null;
  group?: {
    id: string;
    name: string;
  } | null;
}

export interface FolderGroup {
  id: string;
  name: string;
  position?: number;
}

export interface OrderItem {
  type: "folder" | "group";
  id: string;
}

export interface FileEntry {
  id: string;
  fileName: string;
  fileType: "image" | "video";
  fileSize: string;
  folderId: string;
  createdAt: string;
  order?: number;
  viewCount: number;
  downloadCount: number;
  lastViewedAt?: string | null;
  lastDownloadedAt?: string | null;
  pendingRequests: number;
  variants: Array<{
    id: string;
    name: string;
    path: string;
    size: string;
  }>;
}

export interface ImageRequestEntry {
  id: string;
  email: string | null;
  name: string | null;
  note: string | null;
  status: "PENDING" | "FULFILLED" | "DISMISSED";
  createdAt: string;
  file: {
    id: string;
    fileName: string;
    fileType: "image" | "video";
    folder: { id: string; name: string };
    variants: Array<{ name: string; path: string }>;
  };
}

export interface ConflictInfo {
  action: "move" | "copy";
  targetFolderId: string;
  conflicts: Array<{
    fileId: string;
    fileName: string;
    existingFileId: string;
  }>;
}

export type FolderListItem =
  | {
      type: "group";
      group: FolderGroup;
      count: number;
      isOpen: boolean;
      orderIndex: number;
    }
  | {
      type: "folder";
      folder: Folder;
      indent: boolean;
      orderIndex: number;
    };
