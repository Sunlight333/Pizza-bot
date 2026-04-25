export function Skeleton({ className = '', ...props }) {
  return <div className={`skeleton ${className}`} {...props} />
}

export function SkeletonRow({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`glass-card p-4 ${className}`}>
      <Skeleton className="h-5 w-2/3 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  )
}
