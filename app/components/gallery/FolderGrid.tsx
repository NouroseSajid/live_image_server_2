'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Folder {
  id: string;
  name: string;
  folderThumb: string | null;
  uniqueUrl: string;
}

interface FolderGridProps {
  folders: Folder[];
  onFolderClick?: (folder: Folder) => void;
}

const FolderGrid: React.FC<FolderGridProps> = ({ folders, onFolderClick }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 w-[95%] mx-auto">
      {folders.map((folder) => (
        <motion.div
          key={folder.id}
          className="relative group cursor-pointer overflow-hidden rounded-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
          onClick={() => onFolderClick?.(folder)}
        >
          <div className="aspect-w-16 aspect-h-12">
            <img
              src={folder.folderThumb || '/placeholder-folder.jpg'}
              alt={folder.name}
              className="w-full h-full object-cover rounded-xl shadow-lg border border-gray-200/10"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/50 to-transparent rounded-b-xl">
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white text-sm font-medium truncate">
                {folder.name}
              </p>
            </div>
          </div>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl flex items-center justify-center">
            <p className="text-white text-sm font-medium px-4 py-2 bg-black/60 rounded-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
              View Folder
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default FolderGrid;