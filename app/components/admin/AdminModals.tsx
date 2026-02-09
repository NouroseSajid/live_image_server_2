import FolderEditorModal, { type FolderUpdate } from "../FolderEditorModal";
import GroupManagerModal from "./GroupManagerModal";
import type { Folder, FolderGroup } from "./types";

interface AdminModalsProps {
  editingFolder: Folder | null;
  groups: FolderGroup[];
  isSaving: boolean;
  onCloseEditing: () => void;
  onSaveFolder: (updated: Partial<FolderUpdate>) => Promise<void>;
  showGroupModal: boolean;
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
  onCloseGroupModal: () => void;
}

export default function AdminModals({
  editingFolder,
  groups,
  isSaving,
  onCloseEditing,
  onSaveFolder,
  showGroupModal,
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
  onCloseGroupModal,
}: AdminModalsProps) {
  return (
    <>
      {editingFolder && (
        <FolderEditorModal
          folder={editingFolder}
          groups={groups}
          onClose={onCloseEditing}
          onSave={onSaveFolder}
          isLoading={isSaving}
        />
      )}

      <GroupManagerModal
        isOpen={showGroupModal}
        groups={groups}
        groupDrafts={groupDrafts}
        newGroupName={newGroupName}
        creatingGroup={creatingGroup}
        savingGroupId={savingGroupId}
        deletingGroupId={deletingGroupId}
        onNewGroupNameChange={onNewGroupNameChange}
        onGroupDraftChange={onGroupDraftChange}
        onCreateGroup={onCreateGroup}
        onSaveGroup={onSaveGroup}
        onDeleteGroup={onDeleteGroup}
        onClose={onCloseGroupModal}
      />
    </>
  );
}
