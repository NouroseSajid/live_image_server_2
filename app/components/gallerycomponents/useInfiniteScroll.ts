import { useCallback, useEffect, useRef } from "react";

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
  const isLoadingRef = useRef(isLoading);
  const hasMoreRef = useRef(hasMore);
  const loadLockRef = useRef(false);

  const triggerLoadMore = useCallback(() => {
    if (!isLoadingRef.current) {
      loadLockRef.current = false;
    }
    if (!loadLockRef.current && !isLoadingRef.current && hasMoreRef.current) {
      loadLockRef.current = true;
      onLoadMore();
    }
  }, [onLoadMore]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
    if (!isLoading) {
      loadLockRef.current = false;
    }
  }, [isLoading]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          triggerLoadMore();
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
  }, [triggerLoadMore]);

  return { sentinelRef, triggerLoadMore };
}
