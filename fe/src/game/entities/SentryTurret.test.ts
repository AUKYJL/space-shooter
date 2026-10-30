import { describe, expect, it } from 'vitest'
import { SentryTurret } from './SentryTurret'

const player = { x: 300, y: 600 }
function setup() {
  const enemy = new SentryTurret()
  enemy.spawn(100, 144, 1.15)
  return enemy
}

describe('SentryTurret model', () => {
  it('decelerates, stops, aims immediately and fires only after the first interval', () => {
    const enemy = setup()
    expect(enemy.hp).toBe(14)
    const initial = enemy.position.y
    expect(enemy.update(600, player)).toBeNull()
    const middle = enemy.position.y
    expect(enemy.update(600, player)).toBeNull()
    expect(middle - initial).toBeGreaterThan(enemy.position.y - middle)
    expect(enemy.state).toBe('active')
    expect(enemy.position.y).toBe(144)
    expect(enemy.angle).toBeCloseTo(Math.atan2(456, 200))
    expect(enemy.update(1799, player)).toBeNull()
    const shot = enemy.update(1, player)!
    expect(shot.x / shot.y).toBeCloseTo(200 / 456)
    enemy.update(16, { x: 0, y: 144 })
    expect(enemy.angle).toBe(Math.PI)
    expect(shot.x / shot.y).toBeCloseTo(200 / 456)
    expect(enemy.update(1784, { x: 0, y: 144 })!.x).toBeCloseTo(-1)
  })

  it('carries phase time, suppresses catch-up bursts and leaves upwards without firing', () => {
    const enemy = setup()
    expect(enemy.update(3000, player)).not.toBeNull()
    expect(enemy.update(5000, player)).not.toBeNull()
    expect(enemy.update(0, player)).toBeNull()
    expect(enemy.update(3200, player)).toBeNull()
    expect(enemy.state).toBe('leaving')
    enemy.update(450, player)
    expect(enemy.position.y).toBeLessThan(144)
    expect(enemy.active).toBe(true)
    expect(enemy.update(450, player)).toBeNull()
    expect(enemy.state).toBe('inactive')
    expect(enemy.isDead()).toBe(false)
    expect(enemy.update(10000, player)).toBeNull()
  })

  it.each([0, 1200, 11200])('can be destroyed during each live phase (%s ms) and reused cleanly', (age) => {
    const enemy = setup()
    enemy.update(age, player)
    enemy.takeDamage(100)
    expect(enemy.hp).toBe(0)
    expect(enemy.active).toBe(false)
    expect(enemy.isDead()).toBe(true)
    enemy.takeDamage(1)
    expect(enemy.update(5000, player)).toBeNull()
    enemy.spawn(200, 100, 1)
    expect(enemy.state).toBe('entering')
    expect(enemy.hp).toBe(12)
    expect(enemy.angle).toBe(Math.PI / 2)
    expect(enemy.update(2999, player)).toBeNull()
  })
})
