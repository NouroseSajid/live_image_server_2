import { FiEdit2, FiFolder, FiTrash2 } from "react-icons/fi";
import type { Folder, FolderListItem } from "./types";

interface FolderListProps {
  items: FolderListItem[];
  activeFolderId: string | null;
  onToggleGroupOpen: (groupId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
}

export default function FolderList({
  items,
  activeFolderId,
  onToggleGroupOpen,
  onSelectFolder,
  onEditFolder,
  onDeleteFolder,
}: FolderListProps) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={`${item.type}-${item.orderIndex}`} className="space-y-1">
          {item.type === "group" ? (
            <div
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 bg-white/60 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
            >
              <button
                type="button"
                onClick={() => onToggleGroupOpen(item.group.id)}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 flex-1 text-left"
              >
                <span className="inline-flex min-w-[38px] justify-center rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                  #{item.orderIndex + 1}
                </span>
                <FiFolder size={14} />
                <span>{item.group.name}</span>
                <span className="text-[10px] text-gray-400">({item.count})</span>
              </button>
              <span className="text-[10px] text-gray-400">
                {item.isOpen ? "▼" : "▶"}
              </span>
            </div>
          ) : (
            <div
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                item.indent ? "ml-6 border-l-2 border-gray-300 dark:border-gray-600 pl-4" : ""
              } ${
                activeFolderId === item.folder.id
                  ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-500"
                  : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
              } ${
                ""
              }`}
              onClick={() => onSelectFolder(item.folder.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex min-w-[38px] justify-center rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                      #{item.orderIndex + 1}
                    </span>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {item.folder.name}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.folder.uniqueUrl}
                    {item.folder.groupId && " (in group)"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditFolder(item.folder);
                    }}
                    className="text-blue-500 hover:text-blue-600 p-1"
                    title="Edit folder settings"
                  >
                    <FiEdit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFolder(item.folder.id);
                    }}
                    className="text-red-500 hover:text-red-600 p-1"
                    title="Delete folder"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
