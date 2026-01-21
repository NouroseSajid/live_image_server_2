// app/lib/useUploads.ts
"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type Upload = {
  id: string;
  file: File;
  folderId: string; // Add folderId
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  result?: any;
};

type State = { uploads: Upload[] };
type Actions = {
  add: (files: File[], folderId: string) => void; // Update add signature
  remove: (id: string) => void;
  update: (id: string, patch: Partial<Upload>) => void;
};

export const useUploads = create<State & Actions>()(
  immer((set, _get) => ({
    uploads: [],

    add(files, folderId) {
      // Update add signature here too
      set((state) => {
        for (const file of files) {
          const id = `${file.name}-${file.size}-${file.lastModified}`;
          if (state.uploads.some((u) => u.id === id)) continue; // skip duplicates
          state.uploads.push({
            id,
            file,
            folderId,
            status: "pending",
            progress: 0,
          }); // Add folderId
        }
      });
    },

    remove(id) {
      set((state) => {
        state.uploads = state.uploads.filter((u) => u.id !== id);
      });
    },

    update(id, patch) {
      set((state) => {
        const upload = state.uploads.find((u) => u.id === id);
        if (upload) Object.assign(upload, patch);
      });
    },
  })),
);
