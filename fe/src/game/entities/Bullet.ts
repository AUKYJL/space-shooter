import type { Container } from 'pixi.js'
import { BulletView } from '@/game/views/BulletView'

export class Bullet {
  readonly view: Container
  radius = 0

  active = false
  damage = 0
  baseDamage = 0
  pierceLeft = 0
  private falloff: { startPx: number; endPx: number } | null = null
  private traveledPx = 0
  private hitTargets: WeakSet<object> = new WeakSet()

  private visual = new BulletView()
  private color = 0xf8f8f2
  private vx = 0
  private vy = 0
  private ageMs = 0
  private lifetimeMs = 0

  constructor() {
    this.view = this.visual.view
    this.redraw()
  }

  private redraw() {
    this.visual.draw(this.radius, this.color)
  }

  spawn(options: {
    x: number
    y: number
    directionX: number
    directionY: number
    speed: number
    lifetimeMs: number
    damage: number
    radius: number
    color?: number
    falloff: { startPx: number; endPx: number } | null
    pierceLeft: number
  }) {
    this.active = true
    this.ageMs = 0
    this.baseDamage = options.damage
    this.damage = this.baseDamage
    this.pierceLeft = Math.max(0, Math.floor(options.pierceLeft))
    this.falloff = options.falloff
    this.traveledPx = 0
    this.hitTargets = new WeakSet()
    this.lifetimeMs = options.lifetimeMs
    const nextRadius = options.radius
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
    // Culling margin outside the viewport; not a gameplay default.
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

  hasHitTarget(target: object) {
    return this.hitTargets.has(target)
  }

  registerTargetHit(target: object) {
    this.hitTargets.add(target)
  }

  destroy() {
    this.view.destroy({ children: true })
  }
}
