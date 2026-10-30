import { useEffect, useMemo, useState } from 'react'

import { EventBus } from '@/game/core/EventBus'
import { onRunHudUpdate, onRunFinished, type RunBridgeEventMap, type RunHudState } from '@/game/ui-bridge/gameToReact'
import { emitChargeActivate, emitRunPause, emitRunResume } from '@/game/ui-bridge/reactToGame'
import { GameCanvas } from '@/modules/runs/GameCanvas'
import { PauseOverlay } from '@/modules/runs/PauseOverlay'
import { RunHud } from '@/modules/runs/RunHud'
import { RunResultDrawer } from '@/modules/runs/RunResultDrawer'
import { useAppStore } from '@/shared/store/appStore'
import { useFinishRunMutation, useStartRunMutation } from '@/modules/runs/api/runsQueries'
import { ApiError } from '@/shared/api/client'

export function RunPage() {
  const events = useMemo(() => new EventBus<RunBridgeEventMap>(), [])
  const setLastRunSummary = useAppStore((s) => s.setLastRunSummary)
  const weaponId = useAppStore((s) => s.selectedWeaponId)
  const [paused, setPaused] = useState(false)
  const [runInit, setRunInit] = useState<{
    runId: string
    seed: number
    snapshot: { weaponId: string; damage: number; fireRate: number; maxHp: number }
  } | null>(null)

  const startRunMutation = useStartRunMutation()
  const finishRunMutation = useFinishRunMutation()
  const { mutate: startRun } = startRunMutation
  const [hud, setHud] = useState<RunHudState>({
    stage: 1,
    hp: 10,
    maxHp: 10,
    charge: 0,
    multiplier: 1,
    coins: 0,
    iron: 0,
    gold: 0,
    crystal: 0,
    extractionAvailable: false,
    extractionInZone: false,
    extractionBaseTtlMs: 0,
    extractionProgressMs: 0,
    extractionRequiredMs: 3000,
  })

  useEffect(() => onRunHudUpdate(events, setHud), [events])

  useEffect(() => {
    if (!weaponId) return
    startRun(
      { weaponId },
      {
        onSuccess: (res) => {
          setRunInit(res)
        },
      },
    )
  }, [startRun, weaponId])

  useEffect(
    () =>
      onRunFinished(events, (summary) => {
        setLastRunSummary(summary)
        setPaused(false)

        if (!runInit) return
        finishRunMutation.mutate({
          runId: runInit.runId,
          durationMs: Math.round(summary.durationMs),
          endedBy: summary.endedBy,
          extractionCount: summary.extractionCount,
          rewardMultiplier: summary.multiplier,
          summary: {
            asteroidsDestroyed:
              summary.destroyed.normal + summary.destroyed.fast + summary.destroyed.big + summary.destroyed.armored,
            largeAsteroidsDestroyed: summary.destroyed.big,
            armoredAsteroidsDestroyed: summary.destroyed.armored,
            rareAsteroidsDestroyed: summary.destroyed.fast,
            coinsCollected: summary.collected.coins,
            resourcesCollected: { ore: summary.collected.iron, crystal: summary.collected.crystal },
          },
        })
      }),
    [events, finishRunMutation, runInit, setLastRunSummary],
  )

  const startError = startRunMutation.error
  const startErrorMessage =
    startError instanceof ApiError ? startError.message : startError instanceof Error ? startError.message : null

  return (
    <div className="relative h-full w-full bg-black">
      <div className="absolute inset-0 z-0">
        {runInit ? <GameCanvas events={events} init={runInit} /> : null}
      </div>
      {!runInit ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <div className="rounded-xl border border-white/10 bg-bg-secondary px-4 py-3 text-sm">
            {startErrorMessage ? `Failed to start run: ${startErrorMessage}` : 'Starting run…'}
          </div>
        </div>
      ) : null}
      <RunHud
        model={hud}
        onCharge={() => emitChargeActivate(events)}
        onPause={() => {
          setPaused(true)
          emitRunPause(events)
        }}
        pauseDisabled={paused}
      />
      <PauseOverlay
        open={paused}
        onResume={() => {
          setPaused(false)
          emitRunResume(events)
        }}
      />
      <RunResultDrawer />
    </div>
  )
}
