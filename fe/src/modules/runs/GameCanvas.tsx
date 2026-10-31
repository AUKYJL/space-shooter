import { ensureRunAssets } from '@/game/assets/assets'
import type { WeaponId } from '@/shared/lib/weapons'
import { useEffect, useMemo, useRef } from 'react'

import { GameApp } from '@/game/core/GameApp'
import { RunScene } from '@/game/scenes/RunScene'
import type { EventBus } from '@/game/core/EventBus'
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact'
import { loadEnemyAssets } from '@/game/assets/loadEnemyAssets'
import { loadShipAssets } from '@/game/assets/loadShipAssets'
import { loadAsteroidAssets } from '@/game/assets/loadAsteroidAssets'
import { loadLootAssets } from '@/game/assets/loadLootAssets'
import { loadExtractionAssets } from '@/game/assets/loadExtractionAssets'
import { emitRunInit } from '@/game/ui-bridge/reactToGame'
import type { ScoringConfig, StartRunResponse } from './api/runsApi'

export function GameCanvas(props: {
  events: EventBus<RunBridgeEventMap>
  init: StartRunResponse & { scoringConfig: ScoringConfig }
  onReady: () => void
  onError: (error: Error) => void
}) {
  const { events, init, onReady, onError } = props
  const hostRef = useRef<HTMLDivElement | null>(null)
  const tuning = useMemo(() => ({ ...init.snapshot.weaponTuning, maxHp: init.snapshot.maxHp }), [init.snapshot])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // An async renderer from an old StrictMode mount must never clear a newer canvas.
    const mount = document.createElement('div')
    mount.className = 'h-full w-full'
    host.appendChild(mount)
    let game: GameApp | null = null
    let cancelled = false
    let unsubPause: (() => void) | null = null
    let unsubResume: (() => void) | null = null

    void (async () => {
      await ensureRunAssets()
      if (cancelled) return
      const [shipAssets, asteroidAssets, lootAssets, extractionAssets, enemyAssets] = await Promise.all([
        loadShipAssets(), loadAsteroidAssets(), loadLootAssets(), loadExtractionAssets(), loadEnemyAssets(),
      ])
      if (cancelled) return
      const created = await GameApp.create(mount, { backgroundAlpha: 0 })
      if (cancelled) { created.destroy(); return }
      game = created
      unsubPause = events.on('run:pause', () => created.pause())
      unsubResume = events.on('run:resume', () => created.resume())
      created.setScene(
        new RunScene({
          scoringConfig: init.scoringConfig,
          gameplayConfig: init.snapshot.gameplayConfig,
          canvas: created.getCanvas(),
          getViewportSize: () => created.getViewportSize(),
          events: events,
          shipVisuals: shipAssets,
          asteroidVisuals: asteroidAssets,
          lootAssets,
          enemyAssets,
          extractionBaseTexture: extractionAssets.base,
          tuning,
          weaponId: init.snapshot.weaponId as WeaponId,
        }),
      )
      emitRunInit(events, init)
      onReady()
    })().catch((error: unknown) => {
      unsubPause?.()
      unsubResume?.()
      unsubPause = null
      unsubResume = null
      game?.destroy()
      game = null
      if (!cancelled) onError(error instanceof Error ? error : new Error(String(error)))
    })

    return () => {
      cancelled = true
      unsubPause?.()
      unsubPause = null
      unsubResume?.()
      unsubResume = null
      game?.destroy()
      game = null
      mount.remove()
    }
  }, [events, init, onReady, onError, tuning])

  return (
    <div
      ref={hostRef}
      className="h-full w-full overflow-hidden rounded-xl bg-black/20"
      style={{ touchAction: 'none' }}
    />
  )
}
