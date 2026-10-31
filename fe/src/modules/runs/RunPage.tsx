import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/shared/api/queryKeys'
import type { MeResponse } from '@/modules/profile/api/profileApi'
import { ensureRunAssets, getRunAssetState, useAssetsStore } from '@/game/assets/assets'
import { audioManager } from '@/game/audio/AudioManager'
import { LoadingScreen } from '@/shared/ui/LoadingScreen'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { EventBus } from '@/game/core/EventBus'
import { onRunHudUpdate, onRunFinished, type RunBridgeEventMap, type RunHudState } from '@/game/ui-bridge/gameToReact'
import { emitChargeActivate, emitRunPause, emitRunResume } from '@/game/ui-bridge/reactToGame'
import { GameCanvas } from '@/modules/runs/GameCanvas'
import { PauseOverlay } from '@/modules/runs/PauseOverlay'
import { RunHud } from '@/modules/runs/RunHud'
import { RunResultDrawer } from '@/modules/runs/RunResultDrawer'
import { useAppStore } from '@/shared/store/appStore'
import { useFinishRunMutation, useStartRunMutation } from '@/modules/runs/api/runsQueries'
import type { FinishRunRequest, ScoringConfig, StartRunResponse } from './api/runsApi'
import { ApiError } from '@/shared/api/client'

export function RunPage() {
  const bundles = useAssetsStore((state) => state.bundles)
  const assetState = getRunAssetState(bundles)
  const [canvasReady, setCanvasReady] = useState(false)
  const [canvasError, setCanvasError] = useState<Error | null>(null)
  const [canvasAttempt, setCanvasAttempt] = useState(0)
  const onCanvasReady = useCallback(() => setCanvasReady(true), [])
  useEffect(() => {
    // Preserve a background failure until the player explicitly chooses Retry.
    if (getRunAssetState(useAssetsStore.getState().bundles).status !== 'error') {
      void ensureRunAssets().catch(() => {})
    }
  }, [])
  useEffect(() => () => { audioManager.stopSfx(); audioManager.resume('run') }, [])
  const events = useMemo(() => new EventBus<RunBridgeEventMap>(), [])
  const setLastRunSummary = useAppStore((s) => s.setLastRunSummary)
  const weaponId = useAppStore((s) => s.selectedWeaponId)
  const [paused, setPaused] = useState(false)
  const [runInit, setRunInit] = useState<(StartRunResponse & { scoringConfig: ScoringConfig }) | null>(null)
  const finishPayload = useRef<FinishRunRequest | null>(null)
  const queryClient = useQueryClient()
  const previousBest = useRef<number | undefined>(undefined)
  const recordPlayed = useRef<string | null>(null)

  useEffect(() => {
    if (canvasReady && runInit && !finishPayload.current) audioManager.startRunMusic(runInit.runId)
  }, [canvasReady, runInit])

  const startRunMutation = useStartRunMutation()
  const finishRunMutation = useFinishRunMutation()
  const { mutate: startRun } = startRunMutation
  const { mutate: finishRun } = finishRunMutation
  const submitFinish = useCallback((payload: FinishRunRequest) => {
    finishRun(payload, { onSuccess: (result) => {
      if (finishPayload.current?.runId !== payload.runId || recordPlayed.current === payload.runId) return
      if (result.accepted && result.score !== null && previousBest.current !== undefined
        && result.score > previousBest.current && result.score === result.bestScore) {
        recordPlayed.current = payload.runId
        audioManager.playSfx('new_record')
      }
    } })
  }, [finishRun])
  const [hud, setHud] = useState<RunHudState | null>(null)

  useEffect(() => onRunHudUpdate(events, setHud), [events])

  useEffect(() => {
    if (!weaponId || assetState.status !== 'ready') return

    const timer = setTimeout(() => {
      startRun({ weaponId }, { onSuccess: setRunInit })
    }, 0)

    return () => clearTimeout(timer)
  }, [startRun, weaponId, assetState.status])

  useEffect(
    () =>
      onRunFinished(events, (summary) => {
        audioManager.finishRun(summary.endedBy)
        setLastRunSummary(summary)
        setPaused(false)

        if (!runInit) return
        const payload: FinishRunRequest = {
          runId: runInit.runId,
          durationMs: Math.round(summary.durationMs),
          endedBy: summary.endedBy,
          extractionCount: summary.extractionCount,
          rewardMultiplier: summary.multiplier,
          summary: {
            asteroidsDestroyed:
              summary.destroyed.normal + summary.destroyed.fast + summary.destroyed.big + summary.destroyed.armored,
            destroyedByType: summary.destroyed,
            enemiesDestroyed: summary.enemiesDestroyed,
            stageReached: summary.stageReached,
            coinsCollected: summary.collected.coins,
            resourcesCollected: { ore: summary.collected.iron, crystal: summary.collected.crystal },
          },
        }
        previousBest.current = queryClient.getQueryData<MeResponse>(qk.me())?.bestScore
        finishPayload.current = payload
        submitFinish(payload)
      }),
    [events, queryClient, submitFinish, runInit, setLastRunSummary],
  )

  const restart = () => {
    audioManager.stopSfx()
    audioManager.stopMusic()
    audioManager.resume('run')
    setCanvasReady(false)
    setCanvasError(null)
    setRunInit(null)
    setHud(null)
    setPaused(false)
    setLastRunSummary(null)
    finishPayload.current = null
    finishRunMutation.reset()
    startRun({ weaponId }, { onSuccess: setRunInit })
  }

  const startError = startRunMutation.error
  const startErrorMessage =
    startError instanceof ApiError ? startError.message : startError instanceof Error ? startError.message : null

  return (
    <div className="relative h-full w-full bg-black">
      <div className="absolute inset-0 z-0">
        {runInit ? <GameCanvas key={`${runInit.runId}:${canvasAttempt}`} events={events} init={runInit} onReady={onCanvasReady} onError={setCanvasError} /> : null}
      </div>
      {assetState.status !== 'ready' ? (
        <LoadingScreen label="Loading game…" progress={assetState.progress} error={assetState.status === 'error' ? 'Failed to load game assets.' : null}
          onRetry={() => { void ensureRunAssets().catch(() => {}) }} />
      ) : !runInit ? (
        <LoadingScreen label="Starting run…" error={startErrorMessage ? `Failed to start run: ${startErrorMessage}` : null} onRetry={restart} />
      ) : !canvasReady ? (
        <LoadingScreen label="Preparing game…" error={canvasError ? 'Failed to initialize game.' : null} onRetry={() => {
          setCanvasError(null)
          setCanvasAttempt((attempt) => attempt + 1)
        }} />
      ) : null}
      {runInit && canvasReady && <RunHud
        model={hud ?? {
          score: 0, stage: 1, hp: runInit.snapshot.maxHp, maxHp: runInit.snapshot.maxHp,
          charge: 0, multiplier: 1, coins: 0, iron: 0, gold: 0, crystal: 0,
          extractionAvailable: false, extractionInZone: false, extractionBaseTtlMs: 0, extractionProgressMs: 0,
          extractionRequiredMs: runInit.snapshot.gameplayConfig.extraction.requiredMs,
        }}
        onCharge={() => emitChargeActivate(events)}
        onPause={() => {
          audioManager.pause('run')
          setPaused(true)
          emitRunPause(events)
        }}
        pauseDisabled={paused}
      />}
      <PauseOverlay
        open={paused}
        onResume={() => {
          audioManager.resume('run')
          setPaused(false)
          emitRunResume(events)
        }}
      />
      <RunResultDrawer
        result={finishRunMutation.data}
        pending={finishRunMutation.isPending}
        error={finishRunMutation.isError}
        onRetry={() => { if (finishPayload.current) submitFinish(finishPayload.current) }}
        onPlayAgain={restart}
      />
    </div>
  )
}
