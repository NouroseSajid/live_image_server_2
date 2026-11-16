"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FolderGroup } from "@/app/components/admin/types";
import { EmptyState } from "./ui";

export default function GroupsDrawer({
  open,
  groups,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: {
  open: boolean;
  groups: FolderGroup[];
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (groupId: string, name: string) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const next: Record<string, string> = {};
      for (const group of groups) next[group.id] = group.name;
      setDrafts(next);
      setNewName("");
      setError(null);
    }
    wasOpen.current = open;
  }, [open, groups]);

  useEffect(() => {
    if (!open) return;

    setDrafts((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const group of groups) {
        if (!(group.id in next)) {
          next[group.id] = group.name;
          changed = true;
        }
      }

      for (const id of Object.keys(next)) {
        if (!groups.some((group) => group.id === id)) {
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [open, groups]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creating && !savingId && !deletingId) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, creating, savingId, deletingId, onClose]);

  if (!open) return null;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError("Group name cannot be empty.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await onCreate(name);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (groupId: string) => {
    const name = (drafts[groupId] ?? "").trim();
    if (!name) {
      setError("Group name cannot be empty.");
      return;
    }

    setSavingId(groupId);
    setError(null);
    try {
      await onRename(groupId, name);
      setDrafts((prev) => ({ ...prev, [groupId]: name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update group");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (groupId: string) => {
    setDeletingId(groupId);
    setError(null);
    try {
      await onDelete(groupId);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete group");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="an-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="groups-drawer-title"
    >
      <div className="an-drawer">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--an-border)] px-5 py-4">
          <div>
            <h2 id="groups-drawer-title" className="text-[15px] font-semibold">
              Folder groups
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--an-muted)]">
              Group folders in the public navigation.
            </p>
          </div>
          <button
            type="button"
            className="an-icon-btn"
            onClick={onClose}
            aria-label="Close folder groups"
          >
            <X size={16} />
          </button>
        </div>

        <div className="an-scroll flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {error && (
            <div className="rounded-md border border-[var(--an-danger)] bg-[var(--an-danger-soft)] px-3 py-2 text-[12px] leading-relaxed text-[var(--an-danger)]">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="flex items-center gap-2">
            <input
              className="an-input"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="New group name"
              autoComplete="off"
            />
            <button
              type="submit"
              className="an-btn an-btn-primary shrink-0"
              disabled={creating}
            >
              <Plus size={14} />
              {creating ? "Creating…" : "Create"}
            </button>
          </form>

          {groups.length === 0 ? (
            <EmptyState
              title="No groups yet"
              description="Create a group to organize folders in the public navigation."
            />
          ) : (
            <ul className="space-y-2">
              {groups.map((group) => {
                const value = drafts[group.id] ?? group.name;
                const isDirty = value.trim() !== group.name;

                return (
                  <li
                    key={group.id}
                    className="flex items-center gap-2 rounded-md border border-[var(--an-border)] p-2"
                  >
                    <input
                      className="an-input"
                      value={value}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [group.id]: event.target.value,
                        }))
                      }
                      aria-label={`Name for ${group.name}`}
                    />
                    <button
                      type="button"
                      className="an-btn an-btn-soft an-btn-xs shrink-0"
                      onClick={() => void handleSave(group.id)}
                      disabled={!isDirty || savingId === group.id}
                    >
                      {savingId === group.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="an-icon-btn an-icon-btn-danger shrink-0"
                      onClick={() => void handleDelete(group.id)}
                      disabled={deletingId === group.id}
                      aria-label={`Delete ${group.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-[var(--an-border)] px-5 py-4">
          <button type="button" className="an-btn an-btn-soft" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
