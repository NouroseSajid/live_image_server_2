import { useEffect, useRef, useState } from "react";

interface UseInfiniteScrollOptions {
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function useInfiniteScroll({
  isLoading,
  hasMore,
  onLoadMore,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [isLoading, hasMore, onLoadMore]);

  return { sentinelRef };
}
