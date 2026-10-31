import { describe, expect, it } from 'vitest'
import { Sprite, Texture, TextureSource } from 'pixi.js'
import { GAMEPLAY_CONFIG } from '@/test/runConfig'
import { HealZone } from './HealZone'
import { DangerZone } from './DangerZone'

describe('zone icons', () => {
  it.each([
    { Entity: HealZone, config: GAMEPLAY_CONFIG.zones.heal, bounds: [63, 71, 191, 212] },
    { Entity: DangerZone, config: GAMEPLAY_CONFIG.zones.danger, bounds: [13, 19, 240, 226] },
  ])('centers visible artwork and rescales it when a pooled zone respawns ($Entity.name)', ({ Entity, config, bounds }) => {
    const texture = new Texture({ source: new TextureSource({ width: 256, height: 256 }) })
    const zone = new Entity(config, texture)
    const icon = zone.view.children.find((child) => child instanceof Sprite) as Sprite
    const [left, top, right, bottom] = bounds
    for (const radius of [100, 160]) {
      zone.spawn({ x: 30, y: 40, radius, ttlMs: 100 })
      expect(zone.view.visible).toBe(true)
      expect(icon.alpha).toBe(0.85)
      expect(Math.max(right - left, bottom - top) * icon.scale.x).toBeCloseTo(radius * 2 * 0.55)
      expect((left + right) / 2 - icon.anchor.x * 256).toBeCloseTo(0)
      expect((top + bottom) / 2 - icon.anchor.y * 256).toBeCloseTo(0)
      zone.update(100)
      expect(zone.view.visible).toBe(false)
      expect(zone.view.children).toContain(icon)
    }
    zone.destroy()
    expect(texture.destroyed).toBe(false)
    texture.destroy(true)
  })
})
