import { describe, expect, it } from 'vitest'

import { CameraSystem } from '@/game/systems/CameraSystem'

describe('CameraSystem shake', () => {
  it('decays to zero within duration', () => {
    const cam = new CameraSystem()
    cam.shake({ durationMs: 150, amplitudePx: 8 })

    let maxAbs = 0
    for (let t = 0; t < 200; t += 16) {
      cam.update(16)
      const { x, y } = cam.getOffset()
      maxAbs = Math.max(maxAbs, Math.abs(x), Math.abs(y))
    }

    expect(maxAbs).toBeGreaterThan(0)
    expect(Math.abs(cam.getOffset().x) + Math.abs(cam.getOffset().y)).toBe(0)
  })
})

