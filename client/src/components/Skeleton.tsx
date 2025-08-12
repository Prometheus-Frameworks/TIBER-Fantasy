type BaseProps = { className?: string };

export const Shimmer = ({ className = "" }: BaseProps) => (
  <div className={`animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)] bg-[length:200%_100%] ${className}`} />
);

export const SkeletonLine = ({ className = "h-4 rounded bg-zinc-200/80" }: BaseProps) => (
  <div className={`relative overflow-hidden ${className}`}>
    <Shimmer className="absolute inset-0" />
  </div>
);

export const SkeletonPill = ({ className = "h-8 w-24 rounded-full bg-zinc-200/80" }: BaseProps) => (
  <div className={`relative overflow-hidden ${className}`}>
    <Shimmer className="absolute inset-0" />
  </div>
);

export const SkeletonCard = ({ className = "" }: BaseProps) => (
  <div className={`relative overflow-hidden rounded-2xl border border-line bg-white p-5 ${className}`}>
    <div className="space-y-3">
      <SkeletonLine className="h-5 w-1/2" />
      <SkeletonLine className="h-4 w-3/4" />
      <SkeletonLine className="h-4 w-2/3" />
    </div>
    <Shimmer className="absolute inset-0" />
  </div>
);

export const SkeletonTableRow = () => (
  <tr className="border-b border-line/70">
    <td className="p-3"><SkeletonLine className="h-4 w-6" /></td>
    <td className="p-3"><SkeletonLine className="h-4 w-40" /></td>
    <td className="p-3"><SkeletonPill className="h-6 w-12" /></td>
    <td className="p-3"><SkeletonLine className="h-4 w-12" /></td>
  </tr>
);