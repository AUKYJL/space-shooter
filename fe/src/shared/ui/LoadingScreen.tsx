import { Button } from '@/shared/ui/button'

export function LoadingScreen({ label, progress, error, onRetry }: {
  label: string
  progress?: number
  error?: string | null
  onRetry?: () => void
}) {
  const percent = progress == null ? undefined : Math.round(Math.max(0, Math.min(1, progress)) * 100)
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg-primary p-6">
      <div className="w-full max-w-xs space-y-4 text-center">
        <div role={error ? 'alert' : 'status'}>{error ?? label}</div>
        {!error && <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
          className="h-2 overflow-hidden rounded bg-white/10">
          <div className="h-full bg-neon-cyan" style={{ width: percent == null ? '0%' : `${percent}%` }} />
        </div>}
        {!error && percent != null && <div className="text-sm text-text-secondary">{percent}%</div>}
        {error && onRetry && <Button onClick={onRetry}>Retry</Button>}
      </div>
    </div>
  )
}
