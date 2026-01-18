'use client';

import { useState, useEffect } from 'react';
import { FiCheckCircle, FiLoader, FiAlertCircle, FiX } from 'react-icons/fi';

interface IngestFile {
  id: string;
  fileName: string;
  fileType: 'image' | 'video';
  status: 'processing' | 'completed' | 'error';
  timestamp: string;
}

export default function IngestMonitor() {
  const [files, setFiles] = useState<IngestFile[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to SSE for real-time updates
    const eventSource = new EventSource('/api/events');

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'new-file') {
          const newFile: IngestFile = {
            id: data.id,
            fileName: data.fileName,
            fileType: data.fileType,
            status: 'completed',
            timestamp: new Date().toLocaleTimeString(),
          };
          setFiles((prev) => [newFile, ...prev].slice(0, 10)); // Keep last 10 files
        } else if (data.type === 'connected') {
          setIsConnected(true);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    const handleError = () => {
      setIsConnected(false);
      eventSource.close();
    };

    eventSource.addEventListener('message', handleMessage);
    eventSource.addEventListener('error', handleError);

    return () => {
      eventSource.removeEventListener('message', handleMessage);
      eventSource.removeEventListener('error', handleError);
      eventSource.close();
    };
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ingest Monitor</h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No files processed yet</p>
          <p className="text-sm">Files from the ingest folder will appear here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center gap-3 flex-1">
                {file.status === 'completed' && (
                  <FiCheckCircle className="text-green-500 flex-shrink-0" size={18} />
                )}
                {file.status === 'processing' && (
                  <FiLoader className="text-blue-500 flex-shrink-0 animate-spin" size={18} />
                )}
                {file.status === 'error' && (
                  <FiAlertCircle className="text-red-500 flex-shrink-0" size={18} />
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {file.fileName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {file.timestamp} • {file.fileType}
                  </p>
                </div>
              </div>

              <button
                onClick={() => removeFile(file.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 ml-2"
              >
                <FiX size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
