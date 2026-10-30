import { describe, expect, it, vi } from 'vitest'
import type { Application } from 'pixi.js'

import { GameLoop } from '@/game/core/GameLoop'

describe('GameLoop pause', () => {
  it('stops sending dt while paused, without detaching ticker', () => {
    const add = vi.fn()
    const remove = vi.fn()
    const ticker = { add, remove } as unknown as Application['ticker']
    const app = { ticker } as unknown as Application
    const update = vi.fn()

    const loop = new GameLoop(app, update)
    loop.start()
    expect(add).toHaveBeenCalledTimes(1)

    const tick = (loop as unknown as { tick: (t: { deltaMS: number }) => void }).tick

    loop.pause()
    tick({ deltaMS: 16 })
    expect(update).toHaveBeenCalledTimes(0)

    loop.resume()
    tick({ deltaMS: 16 })
    expect(update).toHaveBeenCalledTimes(1)
  })
})
