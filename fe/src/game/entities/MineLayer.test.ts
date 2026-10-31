import { describe, expect, it } from 'vitest'
import { MineLayer } from './MineLayer'
import { MINE_LAYER_CONFIG as cfg } from '@/test/enemyConfig'

const viewport = { width: 400, height: 800 }
describe('MineLayer', () => {
  it('samples the configured height once per spawn, including pool reuse', () => {
    const ship = new MineLayer(cfg)
    for (const [roll, expectedY] of [[0, 160], [0.5, 240], [1, 320]]) {
      ship.spawn(viewport, true, 1, roll)
      expect(ship.position.y).toBeCloseTo(expectedY)
      ship.update(1000)
      ship.update(1000)
      expect(ship.position.y).toBeCloseTo(expectedY)
    }
  })

  it('supports equal height bounds', () => {
    const fixed = new MineLayer({ ...cfg, minHeightRatio: 0.3, maxHeightRatio: 0.3 })
    fixed.spawn(viewport, false, 1, 0.8)
    expect(fixed.position.y).toBe(240)

  })

  it.each([true, false])('follows the mirrored route and drops four spaced mines (left=%s)', (left) => {
    const ship = new MineLayer(cfg)
    ship.spawn(viewport, left, 1.45, 0.25)
    expect(ship.hp).toBe(12)
    expect(ship.position.x).toBe(left ? -20 : 420)
    expect(ship.canDamagePlayer).toBe(false)
    expect(ship.update(999)).toBeNull()
    expect(ship.state).toBe('entering')
    ship.update(1)
    expect(ship.state).toBe('active')
    expect(ship.canDamagePlayer).toBe(true)
    expect(ship.position).toEqual({ x: left ? 60 : 340, y: 200 })
    expect(ship.update(499)).toBeNull()
    const drops = [ship.update(1)]
    for (let i = 0; i < 3; i++) {
      expect(ship.update(999)).toBeNull()
      drops.push(ship.update(1))
    }
    expect(drops.map((drop) => drop?.x)).toEqual(left ? [95, 165, 235, 305] : [305, 235, 165, 95])
    expect(ship.update(500)).toBeNull()
    expect(ship.state).toBe('leaving')
    ship.update(1000)
    expect(ship.state).toBe('inactive')
    expect(ship.position.x).toBe(left ? 420 : -20)
    expect(ship.isDead()).toBe(false)
  })

  it('does not burst or skip entry on long dt and resets for pool reuse', () => {
    const ship = new MineLayer(cfg)
    ship.spawn(viewport, true, 1, 0.25)
    expect(ship.update(100000)).toBeNull()
    expect(ship.state).toBe('active')
    expect(ship.update(100000)).toEqual({ x: 340, y: 200 })
    expect(ship.state).toBe('leaving')
    ship.takeDamage(100)
    expect(ship.isDead()).toBe(true)
    expect(ship.update(100000)).toBeNull()
    ship.spawn(viewport, false, 1, 0.25)
    expect(ship.hp).toBe(8)
    expect(ship.state).toBe('entering')
    ship.update(1000)
    expect(ship.update(500)).toEqual({ x: 305, y: 200 })
  })
})
