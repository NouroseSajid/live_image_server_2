import type { FolderGroup } from "./types";

interface GroupManagerModalProps {
  isOpen: boolean;
  groups: FolderGroup[];
  groupDrafts: Record<string, string>;
  newGroupName: string;
  creatingGroup: boolean;
  savingGroupId: string | null;
  deletingGroupId: string | null;
  onNewGroupNameChange: (value: string) => void;
  onGroupDraftChange: (groupId: string, value: string) => void;
  onCreateGroup: (event: React.FormEvent) => void;
  onSaveGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onClose: () => void;
}

export default function GroupManagerModal({
  isOpen,
  groups,
  groupDrafts,
  newGroupName,
  creatingGroup,
  savingGroupId,
  deletingGroupId,
  onNewGroupNameChange,
  onGroupDraftChange,
  onCreateGroup,
  onSaveGroup,
  onDeleteGroup,
  onClose,
}: GroupManagerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Manage Folder Groups
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Drag groups in the list to reorder them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Close
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <form onSubmit={onCreateGroup} className="flex gap-3">
            <input
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="New group name"
              value={newGroupName}
              onChange={(e) => onNewGroupNameChange(e.target.value)}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              disabled={creatingGroup}
            >
              {creatingGroup ? "Creating..." : "Create"}
            </button>
          </form>

          <div className="space-y-3">
            {groups.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No groups yet
              </p>
            ) : (
              groups.map((group) => {
                const draftValue = groupDrafts[group.id] ?? group.name;
                const isDirty = draftValue.trim() !== group.name;
                return (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <input
                      className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={draftValue}
                      onChange={(e) => onGroupDraftChange(group.id, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => onSaveGroup(group.id)}
                      disabled={!isDirty || savingGroupId === group.id}
                      className="px-3 py-2 rounded-md bg-gray-900 text-white disabled:opacity-50"
                    >
                      {savingGroupId === group.id ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteGroup(group.id)}
                      disabled={deletingGroupId === group.id}
                      className="px-3 py-2 rounded-md border border-red-400 text-red-600 disabled:opacity-50"
                    >
                      {deletingGroupId === group.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
