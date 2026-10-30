import { useEffect, useMemo, useRef } from 'react'

import { GameApp } from '@/game/core/GameApp'
import { RunScene } from '@/game/scenes/RunScene'
import type { EventBus } from '@/game/core/EventBus'
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact'
import { loadShipAssets } from '@/game/assets/loadShipAssets'
import { loadAsteroidAssets } from '@/game/assets/loadAsteroidAssets'
import { loadLootAssets } from '@/game/assets/loadLootAssets'
import { loadExtractionAssets } from '@/game/assets/loadExtractionAssets'
import { emitRunInit } from '@/game/ui-bridge/reactToGame'

export function GameCanvas(props: {
  events: EventBus<RunBridgeEventMap>
  init: { runId: string; seed: number; snapshot: { weaponId: string; damage: number; fireRate: number; maxHp: number } }
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<GameApp | null>(null)
  const tuning = useMemo(() => getRunTuningFromSnapshot(props.init.snapshot), [props.init.snapshot])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let unsubPause: (() => void) | null = null
    let unsubResume: (() => void) | null = null

    ;(async () => {
      const game = await GameApp.create(host, { backgroundAlpha: 0 })
      if (cancelled) {
        game.destroy()
        return
      }

      const shipAssets = await loadShipAssets()
      if (cancelled) {
        game.destroy()
        return
      }

      const asteroidAssets = await loadAsteroidAssets()
      if (cancelled) {
        game.destroy()
        return
      }

      const lootAssets = await loadLootAssets()
      if (cancelled) {
        game.destroy()
        return
      }

      const extractionAssets = await loadExtractionAssets()
      if (cancelled) {
        game.destroy()
        return
      }

      unsubPause = props.events.on('run:pause', () => game.pause())
      unsubResume = props.events.on('run:resume', () => game.resume())
      game.setScene(
        new RunScene({
          canvas: game.getCanvas(),
          getViewportSize: () => game.getViewportSize(),
          events: props.events,
          shipVisuals: shipAssets,
          asteroidVisuals: asteroidAssets,
          lootAssets,
          extractionBaseTexture: extractionAssets.base,
          tuning,
          weaponId: props.init.snapshot.weaponId,
        }),
      )
      emitRunInit(props.events, props.init)
      gameRef.current = game
    })()

    return () => {
      cancelled = true
      unsubPause?.()
      unsubPause = null
      unsubResume?.()
      unsubResume = null
      gameRef.current?.destroy()
      gameRef.current = null
    }
  }, [props.events, props.init, tuning])

  return (
    <div
      ref={hostRef}
      className="h-full w-full overflow-hidden rounded-xl bg-black/20"
      style={{ touchAction: 'none' }}
    />
  )
}

function getRunTuningFromSnapshot(snapshot: { weaponId: string; damage: number; fireRate: number; maxHp: number }) {
  const bulletDamage = Math.max(1, Math.round(snapshot.damage))
  const chargedDamage = Math.max(bulletDamage * 4, bulletDamage + 10)

  const fireRate = Number.isFinite(snapshot.fireRate) ? snapshot.fireRate : 0
  const fireCooldownMs = fireRate > 0 ? Math.max(60, Math.round(1000 / fireRate)) : undefined

  return {
    maxHp: snapshot.maxHp,
    bulletDamage,
    chargedDamage,
    fireCooldownMs,
  }
}
