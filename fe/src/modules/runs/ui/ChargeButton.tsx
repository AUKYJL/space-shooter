import { LightningIcon } from '@/modules/runs/ui/LightningIcon'
import { Button } from '@/shared/ui/button'

export function ChargeButton(props: { charge01: number; onClick: () => void }) {
  const size = 74
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dashOffset = c * (1 - props.charge01)
  const ready = props.charge01 >= 1

  return (
    <Button
      sfx={false}
      type="button"
      size="icon"
      className={[
        'touch-manipulation relative size-[74px] p-0 rounded-full bg-black/55 text-white shadow-[0_10px_25px_rgba(0,0,0,0.35)] backdrop-blur',
        'hover:bg-black/60 active:scale-[0.98]',
        ready ? 'ss-charge-ready-once shadow-[0_0_0_1px_rgba(0,212,255,0.18),0_0_28px_rgba(0,212,255,0.22)]' : '',
      ].join(' ')}
      onPointerDown={(e) => {
        if (!ready) return
        if (e.pointerType === 'mouse' && e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        props.onClick()
      }}
      onKeyDown={(e) => {
        if (!ready) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          props.onClick()
        }
      }}
      disabled={!ready}
      aria-label="Charge shot"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="pointer-events-none absolute inset-0 size-full"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke={ready ? 'rgba(0, 212, 255, 0)' : 'rgba(0, 212, 255, 0.14)'}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke={ready ? 'rgba(0, 212, 255, 0.95)' : 'rgba(0, 212, 255, 0.7)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={`${dashOffset}`}
          style={{ transition: 'stroke-dashoffset 180ms ease-out, stroke 180ms ease-out' }}
        />
      </svg>

      <div className="pointer-events-none relative flex h-full w-full flex-col items-center justify-center">
        <LightningIcon className="size-6 text-neon-cyan" />
        <div className="mt-0.5 text-[10px] font-medium text-white/75">{Math.round(props.charge01 * 100)}%</div>
      </div>
    </Button>
  )
}
