import { Container, Graphics } from 'pixi.js'

export class Bullet {
  readonly view: Container
  radius = 4

  active = false
  damage = 1
  baseDamage = 1
  pierceLeft = 0
  private falloff: { startPx: number; endPx: number } | null = null
  private traveledPx = 0
  private hitAsteroids: WeakSet<object> = new WeakSet()

  private gfx: Graphics
  private color = 0xf8f8f2
  private vx = 0
  private vy = 0
  private ageMs = 0
  private lifetimeMs = 650

  constructor() {
    this.view = new Container()
    this.gfx = new Graphics()
    this.view.addChild(this.gfx)
    this.redraw()
  }

  private redraw() {
    this.gfx.clear()
    this.gfx.circle(0, 0, this.radius).fill({ color: this.color, alpha: 0.9 })
  }

  spawn(options: {
    x: number
    y: number
    directionX: number
    directionY: number
    speed: number
    lifetimeMs?: number
    damage?: number
    radius?: number
    color?: number
    falloff?: { startPx: number; endPx: number }
    pierceLeft?: number
  }) {
    this.active = true
    this.ageMs = 0
    this.baseDamage = options.damage ?? 1
    this.damage = this.baseDamage
    this.pierceLeft = Math.max(0, Math.floor(options.pierceLeft ?? 0))
    this.falloff = options.falloff ?? null
    this.traveledPx = 0
    this.hitAsteroids = new WeakSet()
    this.lifetimeMs = options.lifetimeMs ?? 650
    const nextRadius = options.radius ?? 4
    const nextColor = options.color ?? 0xf8f8f2
    if (nextRadius !== this.radius || nextColor !== this.color) {
      this.radius = nextRadius
      this.color = nextColor
      this.redraw()
    }

    const len = Math.hypot(options.directionX, options.directionY) || 1
    const dx = options.directionX / len
    const dy = options.directionY / len
    this.vx = dx * options.speed
    this.vy = dy * options.speed

    this.view.position.set(options.x, options.y)
    this.view.visible = true
  }

  update(dtMs: number) {
    if (!this.active) return
    this.ageMs += dtMs
    const dx = (this.vx * dtMs) / 1000
    const dy = (this.vy * dtMs) / 1000
    this.view.position.x += dx
    this.view.position.y += dy
    this.traveledPx += Math.hypot(dx, dy)
  }

  shouldDespawn(viewport: { width: number; height: number }) {
    if (!this.active) return true
    if (this.ageMs >= this.lifetimeMs) return true
    const x = this.view.position.x
    const y = this.view.position.y
    const pad = this.radius + 16
    return x < -pad || y < -pad || x > viewport.width + pad || y > viewport.height + pad
  }

  despawn() {
    this.active = false
    this.view.visible = false
  }

  getDamageAtImpact() {
    if (!this.falloff) return this.damage
    const startPx = this.falloff.startPx
    const endPx = this.falloff.endPx
    const d = this.traveledPx
    if (d <= startPx) return Math.max(1, Math.round(this.baseDamage))
    if (d >= endPx) return 1
    const t = (d - startPx) / (endPx - startPx)
    const out = Math.round(this.baseDamage * (1 - t))
    return Math.max(1, out)
  }

  hasHitAsteroid(asteroid: object) {
    return this.hitAsteroids.has(asteroid)
  }

  registerAsteroidHit(asteroid: object) {
    this.hitAsteroids.add(asteroid)
  }

  destroy() {
    this.view.destroy({ children: true })
  }
}
