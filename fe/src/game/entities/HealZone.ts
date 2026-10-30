import { Container, Graphics } from 'pixi.js'

export class HealZone {
  readonly view: Container

  active = false
  radius = 46
  ttlRemainingMs = 0
  readonly healTickMs = 1000
  tickAccumMs = 0

  private gfx: Graphics

  constructor() {
    this.view = new Container()
    this.gfx = new Graphics()
    this.view.addChild(this.gfx)
    this.view.visible = false
  }

  spawn(options: { x: number; y: number; radius?: number; ttlMs?: number }) {
    this.active = true
    this.radius = Math.max(10, Math.round(options.radius ?? 46))
    this.ttlRemainingMs = Math.max(1, Math.round(options.ttlMs ?? 5_000))
    this.tickAccumMs = 0

    this.view.position.set(options.x, options.y)
    this.view.visible = true

    this.gfx.clear()
    this.gfx.circle(0, 0, this.radius).fill({ color: 0x50fa7b, alpha: 0.14 })
    this.gfx.circle(0, 0, this.radius).stroke({ color: 0x50fa7b, width: 2, alpha: 0.65 })
  }

  update(dtMs: number) {
    if (!this.active) return
    this.ttlRemainingMs = Math.max(0, this.ttlRemainingMs - dtMs)
    if (this.ttlRemainingMs <= 0) this.despawn()
  }

  despawn() {
    this.active = false
    this.view.visible = false
    this.tickAccumMs = 0
    this.ttlRemainingMs = 0
  }

  destroy() {
    this.view.destroy({ children: true })
  }
}

