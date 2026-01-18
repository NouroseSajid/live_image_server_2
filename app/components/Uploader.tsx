'use client';

import { useUploads } from '@/app/lib/useUploads';
import { useEffect, useRef } from 'react';
import axios from 'axios';

const Uploader = () => {
  const uploads = useUploads((state) => state.uploads);
  const update = useUploads((state) => state.update);
  const uploadingIdsRef = useRef<Set<string>>(new Set());
  const maxConcurrent = 3;

  useEffect(() => {
    const pendingUploads = uploads.filter(
      (upload) => upload.status === 'pending',
    );

    if (pendingUploads.length > 0 && uploadingIdsRef.current.size < maxConcurrent) {
      const available = maxConcurrent - uploadingIdsRef.current.size;
      const toUpload = pendingUploads.slice(0, available);

      toUpload.forEach((upload) => {
        uploadingIdsRef.current.add(upload.id);
        handleUpload(upload);
      });
    }
  }, [uploads]);

  const handleUpload = async (upload: any) => {
    update(upload.id, { status: 'uploading' });

    try {
      const formData = new FormData();
      formData.append('file', upload.file);
      formData.append('folderId', upload.folderId); // Add folderId to formData
      const res = await axios.post('/api/images/upload', formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            update(upload.id, { progress: Math.min(progress, 99) });
          }
        },
      });

      update(upload.id, { status: 'success', result: res.data, progress: 100 });
    } catch (err: any) {
      const error = err.response?.data?.error || err.message;
      update(upload.id, { status: 'error', error });
    } finally {
      uploadingIdsRef.current.delete(upload.id);
    }
  };

  return null;
};

export default Uploader;