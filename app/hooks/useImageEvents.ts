import { useState, useEffect } from 'react';

interface SSEOptions {
  onImageUpdate?: (images: any[]) => void;
  onProcessingUpdate?: (status: any) => void;
  onError?: (error: any) => void;
}

export function useImageEvents({
  onImageUpdate,
  onProcessingUpdate,
  onError
}: SSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      if (onError) onError(error);
    };

    eventSource.addEventListener('image_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onImageUpdate) onImageUpdate(data.images);
      } catch (error) {
        console.error('Error parsing image update:', error);
      }
    });

    eventSource.addEventListener('processing_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onProcessingUpdate) onProcessingUpdate(data);
      } catch (error) {
        console.error('Error parsing processing update:', error);
      }
    });

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [onImageUpdate, onProcessingUpdate, onError]);

  return { isConnected };
}