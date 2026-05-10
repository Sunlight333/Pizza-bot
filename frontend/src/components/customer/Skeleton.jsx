export function ProductCardSkeleton() {
  return (
    <div className="c-card">
      <div className="c-skeleton aspect-[4/3] !rounded-none" />
      <div className="p-4 space-y-2">
        <div className="c-skeleton h-5 w-2/3" />
        <div className="c-skeleton h-4 w-full" />
        <div className="c-skeleton h-4 w-1/2" />
        <div className="flex justify-between items-center pt-2">
          <div className="c-skeleton h-5 w-24" />
          <div className="c-skeleton h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function OrderRowSkeleton() {
  return (
    <div className="c-card p-4 flex items-center gap-4">
      <div className="c-skeleton h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="c-skeleton h-4 w-1/2" />
        <div className="c-skeleton h-4 w-1/3" />
      </div>
    </div>
  )
}

export function LineSkeleton({ width = '100%' }) {
  return <div className="c-skeleton h-4" style={{ width }} />
}
