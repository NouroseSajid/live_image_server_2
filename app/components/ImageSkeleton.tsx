export function ImageSkeleton() {
  return (
    <div className="relative animate-pulse">
      <div className="w-full h-32 bg-gradient-to-br from-gray-800 to-gray-700 rounded-xl" />
      <div className="absolute inset-0 bg-black/20 rounded-xl" />
    </div>
  );
}

export function ImageSkeletonGrid() {
  return (
    <>
      {/* Using index as a key is safe here because the list is static and will not be reordered. */}
      {Array.from({ length: 10 }).map(() => (
        <ImageSkeleton key={Math.random().toString(36).substring(2, 15)} />
      ))}
    </>
  );
}
