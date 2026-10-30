import { describe, expect, it } from 'vitest'
import { AnimatedSprite, Sprite, Texture } from 'pixi.js'
import { PlayerShip } from '@/game/entities/PlayerShip'

describe('PlayerShip', () => {
  it('creates ship sprite + looping flame animation', () => {
    const ship = new PlayerShip({
      maxHp: 10,
      visuals: {
        shipTexture: Texture.WHITE,
        flameTextures: [Texture.WHITE, Texture.WHITE, Texture.WHITE, Texture.WHITE],
      },
    })

    const all = ship.view.children
    expect(all.some((c) => c instanceof Sprite)).toBe(true)
    const flame = all.find((c) => c instanceof AnimatedSprite) as
      | AnimatedSprite
      | undefined
    expect(flame).toBeTruthy()
    expect(flame!.loop).toBe(true)
    expect(flame!.playing).toBe(true)
  })

  it('uses triangular hitbox when visuals are provided', () => {
    const ship = new PlayerShip({
      visuals: {
        shipTexture: Texture.WHITE,
        flameTextures: [Texture.WHITE, Texture.WHITE, Texture.WHITE, Texture.WHITE],
      },
    })
    ship.setPosition(100, 100)

    expect(ship.intersectsCircle(100, 100, 1)).toBe(true)
    expect(ship.intersectsCircle(100, 30, 5)).toBe(false)
  })
})
