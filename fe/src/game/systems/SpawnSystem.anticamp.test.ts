import { describe, expect, it } from 'vitest'

import { Container } from 'pixi.js'

import { SpawnSystem } from '@/game/systems/SpawnSystem'

describe('SpawnSystem anti-camp', () => {
  it('biases spawns towards top more than bottom', () => {
    const container = new Container()
    const viewport = { width: 400, height: 800 }

    const samples = 2000
    let i = 0
    const rng = () => {
      const v = (i % samples) / samples
      i += 1
      return v
    }

    const spawns = new SpawnSystem({
      container,
      getViewportSize: () => viewport,
      rng,
    })

    let top = 0
    let bottom = 0

    for (let n = 0; n < 200; n += 1) {
      ;(spawns as unknown as { spawnOne: () => void }).spawnOne()
      const asteroid = spawns.getAsteroids().at(-1)
      expect(asteroid).toBeTruthy()
      if (!asteroid) continue

      if (asteroid.view.position.y < 0) top += 1
      if (asteroid.view.position.y > viewport.height) bottom += 1
    }

    expect(top).toBeGreaterThan(bottom)
  })
})
