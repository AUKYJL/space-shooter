import { useNavigate } from '@tanstack/react-router'

import { Button } from '@/shared/ui/button'

export function PauseOverlay(props: { open: boolean; onResume: () => void }) {
  const navigate = useNavigate()

  if (!props.open) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-[320px] rounded-[16px] border border-white/10 bg-bg-secondary p-5">
        <div className="text-center text-2xl font-extrabold text-neon-cyan">Paused</div>
        <div className="mt-2 text-center text-xs text-text-secondary">Game is frozen. Resume when ready.</div>

        <div className="mt-6 space-y-3">
          <Button size="xl" className="h-12 w-full rounded-[14px]" onClick={props.onResume}>
            Resume
          </Button>
          <Button
            size="xl"
            variant="secondary"
            className="h-12 w-full rounded-[14px]"
            onClick={() => navigate({ to: '/' })}
          >
            Exit
          </Button>
        </div>
      </div>
    </div>
  )
}

