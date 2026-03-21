export default function HomeLoading() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      {/* Carousel Skeleton */}
      <div className="relative w-full bg-gray-200 dark:bg-gray-800 animate-pulse">
        <div className="aspect-[16/9] md:aspect-[21/9]" />
        <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-3">
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24" />
        </div>
        <div className="pb-6 flex justify-center gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-700" />
          ))}
        </div>
      </div>

      {/* Currently Streaming Skeleton */}
      <div className="container mx-auto px-6 md:px-12 py-8">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-48 mb-6 animate-pulse" />
        <div className="flex gap-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[160px]">
              <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
              <div className="mt-2 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* News Grid Skeleton */}
      <div className="container mx-auto px-6 md:px-12 pb-8">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-32 mb-6 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="aspect-video bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-20 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
