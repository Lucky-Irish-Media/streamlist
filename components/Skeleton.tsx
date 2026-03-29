export function SkeletonCard() {
  return (
    <div className="card skeleton-card">
      <div className="skeleton-image" />
      <div className="card-content">
        <div className="skeleton-text skeleton-title" />
        <div className="skeleton-text skeleton-meta" />
        <div className="skeleton-actions">
          <div className="skeleton-button" />
          <div className="skeleton-button" />
          <div className="skeleton-button" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonText({ width = '100%', height = '16px' }: { width?: string; height?: string }) {
  return (
    <div 
      className="skeleton-text" 
      style={{ width, height }} 
    />
  )
}
