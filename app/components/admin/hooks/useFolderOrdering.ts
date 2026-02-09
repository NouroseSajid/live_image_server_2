import { useCallback, useEffect, useMemo, useState } from "react";
import type { Folder, FolderGroup, FolderListItem, OrderItem } from "../types";

interface UseFolderOrderingOptions {
  folders: Folder[];
  groups: FolderGroup[];
  setError: (message: string | null) => void;
}

export default function useFolderOrdering({
  folders,
  groups,
  setError,
}: UseFolderOrderingOptions) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [savingOrderItems, setSavingOrderItems] = useState(false);
  const [isOrderDirty, setIsOrderDirty] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch("/api/gallery-order");
        if (!res.ok) throw new Error("Failed to fetch gallery order");
        const data = await res.json();
        setOrderItems(Array.isArray(data) ? data : []);
        setIsOrderDirty(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching order");
      }
    };
    fetchOrder();
  }, [setError]);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      groups.forEach((group) => {
        if (!(group.id in next)) {
          next[group.id] = false;
        }
      });
      return next;
    });
  }, [groups]);

  const orderedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const aPos = a.position ?? 0;
      const bPos = b.position ?? 0;
      if (aPos !== bPos) return aPos - bPos;
      return a.name.localeCompare(b.name);
    });
  }, [groups]);

  const folderMap = useMemo(() => {
    return new Map(folders.map((folder) => [folder.id, folder]));
  }, [folders]);

  const groupMap = useMemo(() => {
    return new Map(orderedGroups.map((group) => [group.id, group]));
  }, [orderedGroups]);

  const effectiveOrderItems = useMemo(() => {
    const existing = orderItems.filter((item) =>
      item.type === "folder" ? folderMap.has(item.id) : groupMap.has(item.id),
    );
    const seen = new Set(existing.map((item) => `${item.type}:${item.id}`));

    orderedGroups.forEach((group) => {
      const key = `group:${group.id}`;
      if (!seen.has(key)) {
        existing.push({ type: "group", id: group.id });
        seen.add(key);
      }
    });

    folders.forEach((folder) => {
      const key = `folder:${folder.id}`;
      if (!seen.has(key)) {
        existing.push({ type: "folder", id: folder.id });
        seen.add(key);
      }
    });

    return existing;
  }, [folders, orderItems, orderedGroups, folderMap, groupMap]);

  const folderListItems = useMemo<FolderListItem[]>(() => {
    const items: FolderListItem[] = [];

    effectiveOrderItems.forEach((item, index) => {
      if (item.type === "group") {
        const group = groupMap.get(item.id);
        if (!group) return;
        const count = folders.filter((folder) => folder.groupId === group.id).length;
        const isOpen = openGroups[group.id] ?? false;
        items.push({ type: "group", group, count, isOpen, orderIndex: index });
        return;
      }

      const folder = folderMap.get(item.id);
      if (!folder) return;
      const isInGroup = Boolean(folder.groupId && groupMap.has(folder.groupId));
      const groupIsOpen = folder.groupId
        ? (openGroups[folder.groupId] ?? false)
        : false;
      const shouldShow = !isInGroup || groupIsOpen;
      if (!shouldShow) return;
      const indent = Boolean(folder.groupId);
      items.push({ type: "folder", folder, indent, orderIndex: index });
    });

    return items;
  }, [effectiveOrderItems, folderMap, folders, groupMap, openGroups]);

  const saveOrderItems = useCallback(async (items: OrderItem[]) => {
    try {
      setSavingOrderItems(true);
      const res = await fetch("/api/gallery-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save order");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving order");
    } finally {
      setSavingOrderItems(false);
    }
  }, [setError]);

  const toggleGroupOpen = useCallback((groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  const getFolderIndex = useCallback(
    (folderId: string | null) => {
      if (!folderId) return null;
      const index = effectiveOrderItems.findIndex(
        (entry) => entry.type === "folder" && entry.id === folderId,
      );
      return index >= 0 ? index : null;
    },
    [effectiveOrderItems],
  );

  const moveFolderByDelta = useCallback(
    (folderId: string | null, delta: number) => {
      if (!folderId) return;
      const currentOrder = [...effectiveOrderItems];
      const sourceIndex = currentOrder.findIndex(
        (entry) => entry.type === "folder" && entry.id === folderId,
      );
      if (sourceIndex === -1) return;

      const nextIndex = Math.max(0, Math.min(currentOrder.length - 1, sourceIndex + delta));
      if (nextIndex === sourceIndex) return;

      const [movedItem] = currentOrder.splice(sourceIndex, 1);
      currentOrder.splice(nextIndex, 0, movedItem);
      setOrderItems(currentOrder);
      setIsOrderDirty(true);
    },
    [effectiveOrderItems, setOrderItems],
  );

  const saveCurrentOrder = useCallback(async () => {
    await saveOrderItems(effectiveOrderItems);
    setIsOrderDirty(false);
  }, [effectiveOrderItems, saveOrderItems]);

  return {
    orderItems,
    setOrderItems,
    effectiveOrderItems,
    folderListItems,
    savingOrderItems,
    isOrderDirty,
    toggleGroupOpen,
    getFolderIndex,
    moveFolderByDelta,
    saveCurrentOrder,
  };
}
