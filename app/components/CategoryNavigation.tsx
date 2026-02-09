"use client";

import { MdLock } from "react-icons/md";
import { FiChevronDown, FiChevronRight, FiFolder } from "react-icons/fi";
import { useEffect, useMemo, useState } from "react";

interface Category {
  id: string;
  name: string;
  isPrivate?: boolean;
  group?: {
    id: string;
    name: string;
    position?: number;
  } | null;
  thumbnail?: {
    id: string;
    variants: Array<{
      path: string;
    }>;
  } | null;
  _count?: {
    files: number;
  };
}

interface CategoryNavigationProps {
  categories: Category[];
  orderItems?: Array<{ type: "folder" | "group"; id: string }> | null;
  activeFolder: string;
  onSelectCategory: (category: string) => void;
}

export default function CategoryNavigation({
  categories,
  orderItems,
  activeFolder,
  onSelectCategory,
}: CategoryNavigationProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [lastToggledGroup, setLastToggledGroup] = useState<string | null>(null);

  const { allCategory, orderedItems } = useMemo(() => {
    const all = categories.find((cat) => cat.id === "all") || null;
    const folderItems = categories.filter((cat) => cat.id !== "all");

    const groupedMap = new Map<
      string,
      { id: string; name: string; position: number; items: Category[] }
    >();

    folderItems.forEach((cat) => {
      if (!cat.group?.id) return;
      if (!groupedMap.has(cat.group.id)) {
        groupedMap.set(cat.group.id, {
          id: cat.group.id,
          name: cat.group.name,
          position: cat.group.position ?? 0,
          items: [],
        });
      }
      groupedMap.get(cat.group.id)?.items.push(cat);
    });

    const items: Array<
      | { type: "group"; group: { id: string; name: string; position: number; items: Category[] } }
      | { type: "folder"; folder: Category }
    > = [];

    const folderMap = new Map(folderItems.map((cat) => [cat.id, cat]));
    const groupMap = new Map(groupedMap);

    const ordered = Array.isArray(orderItems) && orderItems.length > 0
      ? orderItems
      : folderItems.map((cat) => ({ type: "folder" as const, id: cat.id }));

    const seenGroups = new Set<string>();
    const seenFolders = new Set<string>();

    ordered.forEach((item) => {
      if (item.type === "group") {
        const group = groupMap.get(item.id);
        if (!group || seenGroups.has(group.id)) return;
        items.push({ type: "group", group });
        seenGroups.add(group.id);
        return;
      }

      const folder = folderMap.get(item.id);
      if (!folder || seenFolders.has(folder.id)) return;
      items.push({ type: "folder", folder });
      seenFolders.add(folder.id);
    });

    groupMap.forEach((group) => {
      if (!seenGroups.has(group.id)) {
        items.push({ type: "group", group });
        seenGroups.add(group.id);
      }
    });

    folderMap.forEach((folder) => {
      if (!seenFolders.has(folder.id)) {
        items.push({ type: "folder", folder });
        seenFolders.add(folder.id);
      }
    });

    return {
      allCategory: all,
      orderedItems: items,
    };
  }, [categories, orderItems]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    categories.forEach((cat) => {
      if (cat.group?.id && !(cat.group.id in next)) {
        next[cat.group.id] = false;
      }
    });
    const current = categories.find((cat) => cat.id === activeFolder);
    if (current?.group?.id) {
      next[current.group.id] = true;
    }
    setOpenGroups((prev) => ({ ...next, ...prev, ...next }));
  }, [activeFolder, categories]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
    setLastToggledGroup(groupId);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.setTimeout(() => setLastToggledGroup(null), 1200);
  };

  const renderCard = (cat: Category) => {
    const thumbnailPath = cat.thumbnail?.variants?.[0]?.path;
    const isActive = activeFolder === cat.id;

    return (
      <button
        type="button"
        key={cat.id}
        onClick={() => onSelectCategory(cat.id)}
        className={`group relative w-full overflow-hidden rounded-xl border transition-all duration-300 ease-out text-left ${
          isActive
            ? "border-[var(--foreground)]/30 shadow-[0_18px_32px_rgba(0,0,0,0.18)]"
            : "border-[var(--foreground)]/15 hover:border-[var(--foreground)]/30"
        }`}
      >
        <div className="relative w-full aspect-[3/2] bg-[var(--card)] overflow-hidden">
          {thumbnailPath ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
              style={{ backgroundImage: `url('${thumbnailPath}')` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--card)] to-[var(--background)]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-80 transition-opacity duration-300" />

          {isActive && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--primary)]" />
          )}

          {cat.isPrivate && (
            <div className="absolute top-3 right-3 z-20">
              <div className="p-1.5 bg-[var(--popover)]/90 rounded-full shadow-sm border border-[var(--foreground)]/10">
                <MdLock size={14} className="text-[var(--foreground)]/80" />
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`text-[var(--foreground)] text-xs font-semibold truncate leading-tight tracking-wide ${
                  isActive ? "text-[var(--foreground)]" : "text-[var(--foreground)]/75"
                }`}>
                  {cat.name}
                </p>
              </div>

              {cat._count?.files !== undefined && (
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--popover)]/80 text-[var(--foreground)]">
                    {cat._count.files}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
        </div>
      </button>
    );
  };

  const renderGroupCard = (group: {
    id: string;
    name: string;
    position: number;
    items: Category[];
  }) => {
    const isOpen = openGroups[group.id] === true;
    const isHighlighted = lastToggledGroup === group.id;
    const thumbPaths = group.items
      .map((cat) => cat.thumbnail?.variants?.[0]?.path)
      .filter((path): path is string => Boolean(path))
      .slice(0, 4);
    const tiles = Array.from({ length: 4 }, (_val, idx) => thumbPaths[idx] || null);

    return (
      <button
        type="button"
        onClick={() => toggleGroup(group.id)}
        className={`group relative w-full overflow-hidden rounded-xl border transition-all duration-300 ease-out text-left ${
          isHighlighted
            ? "border-[var(--foreground)]/40 shadow-[0_18px_32px_rgba(0,0,0,0.18)]"
            : "border-[var(--foreground)]/15 hover:border-[var(--foreground)]/30"
        } ${isOpen ? "border-blue-500 ring-2 ring-blue-500 bg-blue-100/60 dark:bg-blue-950/40" : ""}`}
        aria-expanded={isOpen}
      >
        <div className="relative w-full aspect-[3/2] bg-[var(--card)] overflow-hidden">
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
            {tiles.map((tile, idx) => (
              <div
                key={`${group.id}-tile-${idx}`}
                className="relative overflow-hidden bg-[var(--card)]"
                style={
                  tile
                    ? { backgroundImage: `url('${tile}')`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined
                }
              >
                {!tile && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--card)] to-[var(--background)]" />
                )}
              </div>
            ))}
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
          
          <div className="absolute top-3 left-3 z-20">
            <div className="p-2 bg-[var(--popover)]/90 rounded-lg shadow-sm border border-[var(--foreground)]/10">
              <FiFolder size={16} className="text-[var(--foreground)]/80" />
            </div>
          </div>

          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--foreground)] bg-[var(--popover)]/80 px-2 py-1 rounded-full">
              {group.items.length}
            </span>
            <div className={`p-1 rounded-full bg-[var(--popover)]/90 border border-[var(--foreground)]/10 shadow-sm transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
              <FiChevronDown size={14} className="text-[var(--foreground)]/80" />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
            <p className="text-[var(--foreground)] text-xs font-semibold truncate leading-tight tracking-wide">
              {group.name}
            </p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--foreground)]/60 mt-1 font-semibold">
              Group
            </p>
          </div>

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/12 transition-colors duration-300" />
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6 mb-12">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">
            Folder list
          </h2>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--foreground)]/15 bg-[var(--background)] shadow-[0_28px_70px_rgba(0,0,0,0.12)]">
        <div className="h-px bg-[var(--foreground)]/5" />

        <div className="p-5 md:p-7">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
            {allCategory && (
              <div className="col-span-2 sm:col-span-1">
                {renderCard(allCategory)}
              </div>
            )}
            {(() => {
              let currentGroupId: string | null = null;
              return orderedItems.map((item, index) => {
                if (item.type === "group") {
                  currentGroupId = item.group.id;
                  return (
                    <div key={`group-${item.group.id}-${index}`} className="col-span-2 sm:col-span-1">
                      {renderGroupCard(item.group)}
                    </div>
                  );
                }

                const isGrouped = item.folder.group?.id === currentGroupId;
                const isGroupOpen = Boolean(currentGroupId && openGroups[currentGroupId]);
                const isHidden =
                  isGrouped && currentGroupId && openGroups[currentGroupId] !== true;
                if (isHidden) return null;

                const groupHighlightClass = isGrouped && isGroupOpen
                  ? "ring-2 ring-blue-500 bg-blue-100/60 dark:bg-blue-950/40 rounded-lg"
                  : "";

                return (
                  <div
                    key={`folder-${item.folder.id}-${index}`}
                    className={`col-span-1 ${groupHighlightClass}`}
                  >
                    {renderCard(item.folder)}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}