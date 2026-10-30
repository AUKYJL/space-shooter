export function StationCard({
  title,
  subtitle,
  meta,
}: {
  title: string
  subtitle: string
  meta: string
}) {
  return (
    <div className="rounded-xl border border-neon-cyan/30 bg-bg-secondary px-4 py-4 shadow-[0_0_32px_rgba(0,212,255,0.15)]">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-text-secondary">{subtitle}</div>
      <div className="mt-3 text-xs text-text-secondary">{meta}</div>
    </div>
  )
}

