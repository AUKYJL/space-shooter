import { Container, Graphics, Sprite, Texture } from 'pixi.js'

export type LootType = 'coins' | 'iron' | 'gold' | 'crystal'

const LOOT_COLOR: Record<LootType, number> = {
  coins: 0xf1fa8c,
  iron: 0xa78bfa,
  gold: 0xffc107,
  crystal: 0x00d4ff,
}

export class LootDrop {
  readonly view: Container

  active = false
  type: LootType = 'coins'
  amount = 1
  radius = 7

  private gfx: Graphics
  private sprite: Sprite
  private ageMs = 0
  private bobPhase = 0

  constructor() {
    this.view = new Container()
    this.gfx = new Graphics()
    this.sprite = new Sprite()
    this.sprite.anchor.set(0.5, 0.5)
    this.view.addChild(this.gfx)
    this.view.addChild(this.sprite)
    this.view.visible = false
  }

  spawn(options: { type: LootType; amount: number; x: number; y: number; texture?: Texture }) {
    this.active = true
    this.type = options.type
    this.amount = options.amount
    this.ageMs = 0
    this.bobPhase = Math.random() * Math.PI * 2

    this.view.position.set(options.x, options.y)
    this.view.visible = true

    if (options.texture) {
      const size = this.radius * 2
      this.sprite.texture = options.texture
      this.sprite.visible = true
      this.sprite.width = size
      this.sprite.height = size

      this.gfx.visible = false
      this.gfx.clear()
    } else {
      this.sprite.visible = false

      const color = LOOT_COLOR[options.type]
      this.gfx.visible = true
      this.gfx.clear()
      this.gfx.circle(0, 0, this.radius).fill({ color, alpha: 0.95 })
      this.gfx.circle(-2, -2, 2).fill({ color: 0x0b1020, alpha: 0.22 })
    }
  }

  update(dtMs: number) {
    if (!this.active) return
    this.ageMs += dtMs
    // Subtle idle bobbing to help distinguish from background.
    this.bobPhase += (dtMs / 1000) * 3.2
    this.view.position.y += Math.sin(this.bobPhase) * 0.15
  }

  isExpired(lifetimeMs: number) {
    return this.active && this.ageMs > lifetimeMs
  }

  despawn() {
    this.active = false
    this.view.visible = false
  }

  destroy() {
    this.view.destroy({ children: true })
  }
}
