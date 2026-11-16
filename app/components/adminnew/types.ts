export type AdminSection =
  | "overview"
  | "library"
  | "folders"
  | "requests"
  | "settings";

export type ToastKind = "success" | "error";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface FolderDraft {
  name: string;
  uniqueUrl?: string;
  isPrivate: boolean;
  visible: boolean;
  archived: boolean;
  passphrase: string | null;
  inGridView: boolean;
  groupId: string | null;
}
