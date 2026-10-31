import { audioManager } from '@/game/audio/AudioManager'
import { useNavigate } from '@tanstack/react-router'

import { useAppStore } from '@/shared/store/appStore'
import { Button } from '@/shared/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/shared/ui/drawer'
import { ResourceIcon } from '@/shared/ui/ResourceIcon'
import type { FinishRunResponse } from './api/runsApi'

export function RunResultDrawer(props: {
  result?: FinishRunResponse
  pending: boolean
  error: boolean
  onRetry: () => void
  onPlayAgain: () => void
}) {
  const navigate = useNavigate()
  const lastRun = useAppStore((s) => s.lastRunSummary)
  const setLastRunSummary = useAppStore((s) => s.setLastRunSummary)

  const debugOpen =
    new URLSearchParams(window.location.search).has('debugResult') || window.location.hash.includes('debugResult')

  const model =
    lastRun ??
    (debugOpen
      ? {
          durationMs: 72_000,
          score: 0,
          stageReached: 1,
          endedBy: 'extract' as const,
          extractionCount: 12,
          multiplier: 2.5,
          collected: { coins: 2450, iron: 23, gold: 8, crystal: 15 },
          banked: { coins: 6125, iron: 58, gold: 20, crystal: 38 },
          destroyed: { normal: 0, fast: 0, big: 0, armored: 0 },
        }
      : null)

  const open = Boolean(model)
  if (!model) return null

  const rewards = props.result?.grantedRewards

  return (
    <Drawer open={open} dismissible={false}>
      <DrawerContent
        overlayClassName="bg-transparent"
        showHandle={false}
        className="h-[calc(var(--app-vh,1vh)*100)] rounded-none border-0 bg-bg-primary"
      >
        <DrawerTitle className="sr-only">Run Complete</DrawerTitle>
        <DrawerDescription className="sr-only">Run result summary</DrawerDescription>
        <div className="mx-auto flex h-full w-full max-w-[390px] flex-col gap-6 overflow-y-auto px-6 pt-[calc(40px+env(safe-area-inset-top))] pb-[calc(40px+env(safe-area-inset-bottom))] [&>div]:shrink-0">
          <div className="text-center text-[36px] font-extrabold tracking-[1px] text-neon-cyan">Run Complete</div>

          <div className="text-center" aria-live="polite">
            <div className="text-sm text-text-secondary">Score</div>
            <div className="text-3xl font-bold">{props.result ? (props.result.score?.toLocaleString() ?? '—') : model.score.toLocaleString()}</div>
            {props.pending ? <div>Confirming result…</div> : null}
            {props.error ? <div>Could not save result. <button className="underline" onClick={() => { props.onRetry(); audioManager.playSfx('ui_click') }}>Retry</button></div> : null}
            {props.result?.accepted === false ? <div>Result rejected. No rewards or record update.</div> : null}
          </div>

          <div className="rounded-[14px] bg-bg-secondary p-5">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-text-secondary">
                  <ResourceIcon id="coins" size={12} />
                  <span>Total Coins</span>
                </div>
                <div className="mt-1 text-xl font-bold text-accent-gold">{rewards ? rewards.coins.toLocaleString() : '—'}</div>
              </div>
              <div className="text-center">
                <div className="text-[11px] text-text-secondary">Multiplier</div>
                <div className="mt-1 text-xl font-bold text-neon-purple">{model.multiplier.toFixed(1)}x</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-text-secondary">Extractions</div>
                <div className="mt-1 text-xl font-bold text-neon-cyan">{model.extractionCount}</div>
              </div>
            </div>

            <div className="mt-4 text-xs font-semibold text-white">Resources Granted</div>

            <div className="mt-4 space-y-2">
              <ResourceRow iconResourceId="crystals" label="Crystals" value={rewards?.resources.crystal} />
              <ResourceRow iconResourceId="iron" label="Iron" value={rewards?.resources.ore} />
            </div>
          </div>

          <div className="flex-1" />

          <div className="w-full space-y-3">
            <Button
              disabled={props.pending}
              size="xl"
              className="h-14 w-full rounded-[14px] bg-neon-cyan text-base font-bold text-bg-primary hover:bg-neon-cyan/90"
              onClick={() => {
                setLastRunSummary(null)
                navigate({ to: '/' })
              }}
            >
              Exit to Menu
            </Button>

            <Button
              sfx="ui_start"
              disabled={props.pending || !props.result}
              size="xl"
              className="h-14 w-full rounded-[14px] border-[1.5px] border-neon-purple bg-bg-tertiary text-base font-bold text-neon-purple hover:bg-bg-tertiary/80"
              onClick={() => {
                props.onPlayAgain()
              }}
            >
              Play Again
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function ResourceRow(props: {
  colorClassName?: string
  iconResourceId?: 'iron' | 'crystals'
  label: string
  value?: number
}) {
  return (
    <div className="flex items-center gap-2 px-2">
      {props.iconResourceId ? (
        <ResourceIcon id={props.iconResourceId} size={20} className="rounded-[4px]" />
      ) : (
        <div className={`size-5 rounded-[4px] ${props.colorClassName ?? ''}`} aria-hidden="true" />
      )}
      <div className="text-[12px] text-text-secondary">
        {props.label} {props.value === undefined ? '—' : `x${props.value.toLocaleString()}`}
      </div>
    </div>
  )
}
