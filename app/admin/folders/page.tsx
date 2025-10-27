"use client";

import { useEffect, useState } from 'react';

interface Folder {
  id: string;
  name: string;
  isPrivate: boolean;
  visible: boolean;
  uniqueUrl: string;
  passphrase: string | null;
  inGridView: boolean;
  folderThumb: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolder, setNewFolder] = useState({
    name: '',
    isPrivate: true,
    visible: true,
    passphrase: '',
    inGridView: false,
    folderThumb: '',
  });
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    const res = await fetch('/api/folders');
    if (res.ok) {
      const data = await res.json();
      setFolders(data);
    } else {
      console.error('Failed to fetch folders');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const folderToProcess = editingFolder || newFolder;

    if (!folderToProcess.name || !folderToProcess.name.trim()) {
      setStatusMessage({ type: 'error', text: 'Name is required' });
      return;
    }

    if (editingFolder) {
      setUpdating(true);
      const res = await fetch(`/api/folders/${editingFolder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(folderToProcess),
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Folder "${folderToProcess.name}" updated` });
        setEditingFolder(null);
        await fetchFolders();
      } else {
        let errText = 'Failed to update folder';
        try {
          const err = await res.json();
          if (err && err.error) errText = err.error;
        } catch {
          const text = await res.text();
          if (text) errText = text;
        }
        setStatusMessage({ type: 'error', text: errText });
      }
      setUpdating(false);
    } else {
      setCreating(true);
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(folderToProcess),
      });
      if (res.ok) {
        const created = await res.json();
        setStatusMessage({ type: 'success', text: `Folder "${created.name}" created` });
        setNewFolder({
          name: '',
          isPrivate: true,
          visible: true,
          passphrase: '',
          inGridView: false,
          folderThumb: '',
        });
        await fetchFolders();
      } else {
        let errText = 'Failed to create folder';
        try {
          const err = await res.json();
          if (err && err.error) errText = err.error;
        } catch {
          const text = await res.text();
          if (text) errText = text;
        }
        setStatusMessage({ type: 'error', text: errText });
      }
      setCreating(false);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    setStatusMessage(null);
    setDeletingId(id);
    const res = await fetch(`/api/folders/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setStatusMessage({ type: 'success', text: 'Folder deleted' });
      await fetchFolders();
    } else {
      let errText = 'Failed to delete folder';
      try {
        const err = await res.json();
        if (err && err.error) errText = err.error;
      } catch {
        const text = await res.text();
        if (text) errText = text;
      }
      setStatusMessage({ type: 'error', text: errText });
    }
    setDeletingId(null);
  };

  return (
    <div className="admin-theme p-6" style={{ backgroundColor: 'var(--admin-background)', color: 'var(--admin-text)' }}>
      <h1 className="text-2xl font-semibold mb-4">Folder Management</h1>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Existing Folders</h2>
        <ul className="space-y-2 max-w-3xl">
          {folders.map((folder) => (
            <li key={folder.id} className="flex items-center justify-between gap-4 p-3 rounded" style={{ backgroundColor: 'var(--admin-card)' }}>
              <div>
                <div className="font-medium">{folder.name}</div>
                <div className="text-sm text-muted-foreground">{folder.uniqueUrl}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 rounded border" onClick={() => setEditingFolder(folder)} style={{ borderColor: 'var(--admin-border)' }}>
                  Edit
                </button>
                <button
                  className="px-2 py-1 rounded border text-red-600"
                  onClick={() => handleDeleteFolder(folder.id)}
                  style={{ borderColor: 'var(--admin-border)' }}
                  disabled={deletingId === folder.id}
                >
                  {deletingId === folder.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">{editingFolder ? 'Edit Folder' : 'Create New Folder'}</h2>
        {statusMessage && (
          <div className={`mb-3 p-2 rounded ${statusMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {statusMessage.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <input
            className="border rounded px-3 py-2"
            style={{ backgroundColor: 'var(--admin-card)', color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
            type="text"
            placeholder="Name"
            value={editingFolder ? editingFolder.name : newFolder.name}
            onChange={(e) => {
              if (editingFolder) {
                setEditingFolder({ ...editingFolder, name: e.target.value });
              } else {
                setNewFolder({ ...newFolder, name: e.target.value });
              }
            }}
          />


          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editingFolder ? editingFolder.isPrivate : newFolder.isPrivate}
              onChange={(e) => {
                if (editingFolder) {
                  setEditingFolder({ ...editingFolder, isPrivate: e.target.checked });
                } else {
                  setNewFolder({ ...newFolder, isPrivate: e.target.checked });
                }
              }}
            />
            <span>Is Private</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editingFolder ? editingFolder.visible : newFolder.visible}
              onChange={(e) => {
                if (editingFolder) {
                  setEditingFolder({ ...editingFolder, visible: e.target.checked });
                } else {
                  setNewFolder({ ...newFolder, visible: e.target.checked });
                }
              }}
            />
            <span>Visible</span>
          </label>

          <input
            className="border rounded px-3 py-2 md:col-span-2"
            style={{ backgroundColor: 'var(--admin-card)', color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
            type="text"
            placeholder="Passphrase (optional)"
            value={editingFolder ? editingFolder.passphrase || '' : newFolder.passphrase || ''}
            onChange={(e) => {
              if (editingFolder) {
                setEditingFolder({ ...editingFolder, passphrase: e.target.value });
              } else {
                setNewFolder({ ...newFolder, passphrase: e.target.value });
              }
            }}
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editingFolder ? editingFolder.inGridView : newFolder.inGridView}
              onChange={(e) => {
                if (editingFolder) {
                  setEditingFolder({ ...editingFolder, inGridView: e.target.checked });
                } else {
                  setNewFolder({ ...newFolder, inGridView: e.target.checked });
                }
              }}
            />
            <span>In Grid View</span>
          </label>

          <input
            className="border rounded px-3 py-2 md:col-span-2"
            style={{ backgroundColor: 'var(--admin-card)', color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
            type="text"
            placeholder="Folder Thumbnail URL (optional)"
            value={editingFolder ? editingFolder.folderThumb || '' : newFolder.folderThumb || ''}
            onChange={(e) => {
              if (editingFolder) {
                setEditingFolder({ ...editingFolder, folderThumb: e.target.value });
              } else {
                setNewFolder({ ...newFolder, folderThumb: e.target.value });
              }
            }}
          />

          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded"
              style={{ backgroundColor: 'var(--admin-primary)', color: 'var(--admin-primary-foreground)' }}
              disabled={creating || updating}
            >
              {editingFolder ? (updating ? 'Saving…' : 'Save Changes') : (creating ? 'Creating…' : 'Create Folder')}
            </button>
            {editingFolder && (
              <button type="button" onClick={() => setEditingFolder(null)} className="px-4 py-2 rounded border" style={{ borderColor: 'var(--admin-border)' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
