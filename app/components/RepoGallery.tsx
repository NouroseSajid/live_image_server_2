"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import PhotoGrid from "./gallery/PhotoGrid";
import type { Image as GalleryImage, Folder } from "../types/gallery";

export function RepoGallery() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [repoImages, setRepoImages] = useState<GalleryImage[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);

  useEffect(() => {
    fetchFolders();
    fetchRepoImages();
  }, []);

  const fetchFolders = async () => {
    const res = await fetch("/api/folders");
    if (res.ok) {
      const data: Folder[] = await res.json();
      setFolders(data);
    } else {
      console.error("Failed to fetch folders");
    }
  };

  const fetchRepoImages = async (folder: Folder | null = null) => {
    const url = folder ? `/api/images/repo?uniqueUrl=${folder.uniqueUrl}` : "/api/images/repo";
    const res = await fetch(url);
    if (res.ok) {
      const data: GalleryImage[] = await res.json();
      setRepoImages(data);
    } else {
      console.error("Failed to fetch repository images");
    }
  };

  const handleFolderClick = (folder: Folder) => {
    if (folder.isPrivate) {
      setSelectedFolder(folder);
      setShowPassphraseModal(true);
    } else {
      setSelectedFolder(folder);
      fetchRepoImages(folder);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Blurred background placeholder */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-lg opacity-50"
        style={{ backgroundImage: "url('/placeholder-repo-bg.jpg')" }}
      />

      <div className="relative z-10 flex flex-col items-center h-full text-white p-4">
        <h2 className="text-4xl font-bold mb-8 drop-shadow-lg">Repository</h2>

        <div className="w-[95%] space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/30 rounded-xl p-6 shadow-lg"
          >
            <h3 className="text-2xl font-semibold mb-4 drop-shadow">Folders</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {folders.map((folder) => (
                <motion.div
                  key={folder.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative group cursor-pointer"
                  onClick={() => handleFolderClick(folder)}
                >
                  <div className="overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800">
                    <img
                      src={folder.folderThumb || "/placeholder-folder.jpg"}
                      alt={folder.name}
                      className="w-full h-32 object-contain rounded-xl shadow-lg border border-gray-200 bg-gray-50 group-hover:scale-105 transition"
                    />
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-xl"
                  >
                    <p className="text-white text-sm font-medium">{folder.name}</p>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {selectedFolder && (
            <button
              onClick={() => {
                setSelectedFolder(null);
                fetchRepoImages(null);
              }}
              className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition"
            >
              Back to all images
            </button>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/30 rounded-xl p-6 shadow-lg h-[calc(100vh-250px)] overflow-y-auto"
          >
            <h3 className="text-2xl font-semibold mb-4 drop-shadow">{selectedFolder ? `Images in ${selectedFolder.name}` : "All Images"}</h3>
            <PhotoGrid images={repoImages} />
          </motion.div>
        </div>
      </div>

      {/* Passphrase Modal Placeholder */}
      {showPassphraseModal && selectedFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-lg shadow-lg text-black">
            <h3 className="text-xl font-semibold mb-4">Enter Passphrase for {selectedFolder.name}</h3>
            <input type="password" placeholder="Passphrase" className="border p-2 rounded w-full mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPassphraseModal(false)} className="px-4 py-2 rounded border">Cancel</button>
              <button className="px-4 py-2 rounded bg-blue-600 text-white">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}