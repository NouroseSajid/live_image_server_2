'use client';

import { useEffect, useState, useRef } from 'react';
import { FiFolder, FiImage, FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import IngestFolderSelector from './IngestFolderSelector';
import IngestMonitor from './IngestMonitor';
import FolderEditorModal from './FolderEditorModal';
import { useUploads } from '@/app/lib/useUploads';

interface Folder {
  id: string;
  name: string;
  uniqueUrl: string;
  isPrivate: boolean;
  visible: boolean;
  passphrase: string | null;
  inGridView: boolean;
  folderThumb: string | null;
}

interface File {
  id: string;
  fileName: string;
  fileType: 'image' | 'video';
  fileSize: number;
  folderId: string;
  createdAt: string;
}

export default function AdminPanel() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { add } = useUploads();
  const [dragActive, setDragActive] = useState<boolean>(false); // New state for drag and drop
  const dragRef = useRef<HTMLLabelElement | null>(null); // Ref for the drag area

  // Form states
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Fetch folders on mount
  useEffect(() => {
    fetchFolders();
  }, []);

  // Fetch files when active folder changes
  useEffect(() => {
    if (activeFolder) {
      fetchFiles(activeFolder);
    }
  }, [activeFolder]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/folders');
      if (!res.ok) throw new Error('Failed to fetch folders');
      const data = await res.json();
      setFolders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching folders');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async (folderId: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}/files`);
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching files');
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Folder name cannot be empty');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName, visible: true }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create folder');
      }

      const newFolder = await res.json();
      setFolders([...folders, newFolder]);
      setNewFolderName('');
      setSuccess('Folder created successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating folder');
    } finally {
      setLoading(false);
    }
  };

  const updateFolder = async (updated: Partial<Folder>) => {
    if (!editingFolder) return;

    try {
      setIsSaving(true);
      const res = await fetch(`/api/folders/${editingFolder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update folder');
      }

      const updatedFolder = await res.json();
      setFolders(folders.map(f => f.id === editingFolder.id ? updatedFolder : f));
      setSuccess('Folder updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Error updating folder');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder and all its contents?')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete folder');
      }

      setFolders(folders.filter(f => f.id !== folderId));
      if (activeFolder === folderId) {
        setActiveFolder(null);
        setFiles([]);
      }
      setSuccess('Folder deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting folder');
    } finally {
      setLoading(false);
    }
  };

  // handle drag events
  const handleDrag = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // handle drop events
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!activeFolder) {
      setError('Please select a folder first');
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (activeFolder) { // Ensure activeFolder is not null before adding
        add(Array.from(e.dataTransfer.files), activeFolder); // Pass activeFolder
        setSuccess(`Added ${e.dataTransfer.files.length} file(s) from drop to upload queue.`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Please select a folder first to drop files.');
      }
    }
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeFolder) {
      setError('Please select a folder first');
      return;
    }

    const files = e.target.files;
    if (!files || files.length === 0) return;

    e.target.value = ''; // Clear the input so same file can be selected again
    if (activeFolder) { // Ensure activeFolder is not null before adding
      add(Array.from(files), activeFolder); // Pass activeFolder
      // The headless Uploader.tsx will now handle the actual upload
      // and UploadsToast will display the progress and notifications.
      setSuccess(`Added ${files.length} file(s) to upload queue.`);
      setTimeout(() => setSuccess(null), 3000);
      // setFiles will be updated when the upload completes and new files are returned from the API
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/images/${fileId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete image');
      }

      setFiles(files.filter(f => f.id !== fileId));
      setSuccess('Image deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting image');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">Admin Panel</h1>

        {/* Alert Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-200">
            {success}
          </div>
        )}

        {/* Ingest Configuration Section */}
        <div className="mb-8">
          <IngestFolderSelector folders={folders} />
        </div>

        {/* Ingest Monitor Section */}
        <div className="mb-8">
          <IngestMonitor />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Folder Management */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center mb-6">
                <FiFolder className="mr-2 text-blue-500" size={24} />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Folders</h2>
              </div>

              {/* Create Folder */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="New folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 mb-2"
                  onKeyPress={(e) => e.key === 'Enter' && createFolder()}
                />
                <button
                  onClick={createFolder}
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                >
                  <FiPlus className="mr-2" /> Create Folder
                </button>
              </div>

              {/* Folder List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {loading && folders.length === 0 ? (
                  <div className="text-gray-500 dark:text-gray-400">Loading folders...</div>
                ) : folders.length === 0 ? (
                  <div className="text-gray-500 dark:text-gray-400">No folders yet</div>
                ) : (
                  folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        activeFolder === folder.id
                          ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-500'
                          : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                      }`}
                      onClick={() => setActiveFolder(folder.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{folder.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{folder.uniqueUrl}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolder(folder);
                            }}
                            className="text-blue-500 hover:text-blue-600 p-1"
                            title="Edit folder settings"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFolder(folder.id);
                            }}
                            className="text-red-500 hover:text-red-600 p-1"
                            title="Delete folder"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Image Upload and Display */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center mb-6">
                <FiImage className="mr-2 text-purple-500" size={24} />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {activeFolder ? `Images - ${folders.find(f => f.id === activeFolder)?.name}` : 'Select a folder'}
                </h2>
              </div>

              {activeFolder ? (
                <>
                  {/* Upload Area */}
                  <div className="mb-6">
                    <label
                      ref={dragRef} // Assign the ref
                      className={`block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                        ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={uploadImage}
                        className="hidden"
                        disabled={loading}
                      />
                      <div className="text-gray-600 dark:text-gray-400">
                        <FiImage className="mx-auto mb-2" size={32} />
                        <p className="font-semibold">
                          {dragActive ? 'Drop your files here' : 'Drop images or click to upload'}
                        </p>
                        <p className="text-sm">PNG, JPG, GIF, WebP, or video files</p>
                      </div>
                    </label>
                  </div>

                  {/* Files List */}
                  {files.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{files.length} files</p>
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white truncate">{file.fileName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(Number(file.fileSize))} • {file.fileType}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteFile(file.id)}
                            className="text-red-500 hover:text-red-600 ml-2"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      No images in this folder yet
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                  Select a folder from the left to upload images
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Folder Editor Modal */}
      {editingFolder && (
        <FolderEditorModal
          folder={editingFolder}
          onClose={() => setEditingFolder(null)}
          onSave={updateFolder}
          isLoading={isSaving}
        />
      )}
    </div>
  );
}
