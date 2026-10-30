import { describe, expect, it } from 'vitest'
import { Mine } from './Mine'
import { MINE_LAYER_CONFIG } from '@/test/enemyConfig'

const cfg = MINE_LAYER_CONFIG.mine
function spawn() {
  const mine = new Mine(cfg)
  mine.spawn({ x: 100, y: 200 })
  return mine
}

describe('Mine', () => {
  it('arms at the exact boundary, blinks and expires its fuse only after activation', () => {
    const mine = spawn()
    expect(mine.active).toBe(true)
    expect(mine.detonate()).toBe(false)
    mine.update(cfg.activationMs - 1)
    expect(mine.state).toBe('dormant')
    mine.update(1)
    expect(mine.state).toBe('armed')
    expect(mine.blinkOn).toBe(true)
    mine.update(cfg.blinkEveryMs)
    expect(mine.blinkOn).toBe(false)
    mine.update(cfg.fuseMs - cfg.blinkEveryMs - 1)
    expect(mine.fuseExpired).toBe(false)
    mine.update(1)
    expect(mine.fuseExpired).toBe(true)
    expect(mine.detonate()).toBe(true)
    expect(mine.detonate()).toBe(false)
    expect(mine.active).toBe(false)
    mine.update(cfg.explosionMs - 1)
    expect(mine.visible).toBe(true)
    mine.update(1)
    expect(mine.visible).toBe(false)
  })

  it('does not skip warning on long dt and resets all state on reuse', () => {
    const mine = spawn()
    mine.update(100000)
    expect(mine.state).toBe('armed')
    expect(mine.fuseExpired).toBe(false)
    mine.detonate()
    mine.spawn({ x: 20, y: 30 })
    expect(mine.state).toBe('dormant')
    expect(mine.hp).toBe(cfg.hp)
    expect(mine.position).toEqual({ x: 20, y: 30 })
    expect(mine.fuseExpired).toBe(false)
  })

  it.each(['dormant', 'armed'] as const)('can be shot down while %s without exploding', (state) => {
    const mine = spawn()
    if (state === 'armed') mine.update(cfg.activationMs)
    mine.takeDamage(1)
    expect(mine.isDead()).toBe(true)
    expect(mine.active).toBe(false)
    expect(mine.visible).toBe(false)
    expect(mine.detonate()).toBe(false)
    mine.update(100000)
    expect(mine.state).toBe('destroyed')
  })
})
