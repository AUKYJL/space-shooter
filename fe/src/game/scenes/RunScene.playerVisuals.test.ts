import { describe, expect, it } from 'vitest'
import { Texture } from 'pixi.js'
import { RunScene } from '@/game/scenes/RunScene'
import { EventBus } from '@/game/core/EventBus'
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact'

describe('RunScene', () => {
  it('accepts ship visuals options', () => {
    const canvas = document.createElement('canvas')
    const events = new EventBus<RunBridgeEventMap>()
    const scene = new RunScene({
      scoringConfig: { version: 1, asteroidPoints: { normal: 10, fast: 20, big: 30, armored: 50 }, stageBonus: 100 },
      canvas,
      getViewportSize: () => ({ width: 800, height: 600 }),
      events,
      shipVisuals: {
        shipTexture: Texture.WHITE,
        flameTextures: [Texture.WHITE, Texture.WHITE, Texture.WHITE, Texture.WHITE],
      },
    })
    expect(scene).toBeTruthy()
  })
})

