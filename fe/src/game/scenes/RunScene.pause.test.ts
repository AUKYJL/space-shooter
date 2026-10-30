import { describe, expect, it } from 'vitest'
import { Container } from 'pixi.js'

import { EventBus } from '@/game/core/EventBus'
import { RunScene } from '@/game/scenes/RunScene'
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact'

describe('RunScene pause', () => {
  it('does not advance time while hard-paused', () => {
    const events = new EventBus<RunBridgeEventMap>()
    const scene = new RunScene({
      canvas: document.createElement('canvas'),
      getViewportSize: () => ({ width: 400, height: 800 }),
      events,
    })

    scene.mount(new Container())

    scene.update(16)
    const elapsed1 = (scene as unknown as { elapsedMs: number }).elapsedMs

    events.emit('run:pause', undefined)
    scene.update(1000)
    const elapsed2 = (scene as unknown as { elapsedMs: number }).elapsedMs
    expect(elapsed2).toBe(elapsed1)

    events.emit('run:resume', undefined)
    scene.update(16)
    const elapsed3 = (scene as unknown as { elapsedMs: number }).elapsedMs
    expect(elapsed3).toBeGreaterThan(elapsed2)

    scene.destroy()
  })
})
