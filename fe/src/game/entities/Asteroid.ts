import type { AsteroidsConfig, AsteroidConfig } from '@/game/core/gameplayConfig'
export type { AsteroidConfig } from '@/game/core/gameplayConfig'
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { DamageableTarget } from './Enemy'

export type AsteroidType = 'normal' | 'big' | 'fast' | 'armored'

const IS_DEBUG = import.meta.env.ENV === 'debug' || import.meta.env.DEV
export const ASTEROID_DEBUG_HITBOX = IS_DEBUG
export const ASTEROID_DEBUG_HP = IS_DEBUG

export class Asteroid implements DamageableTarget {
  readonly view: Container

  active = false
  type: AsteroidType = 'normal'
  radius = 0
  visualScale = 1
  hp = 0
  maxHp = 0

  private sprite: Sprite
  private visuals: Partial<Record<AsteroidType, Texture>> = {}
  private debugGfx?: Graphics
  private debugHpText?: Text
  private vx = 0
  private vy = 0

  private config: AsteroidsConfig

  constructor(config: AsteroidsConfig, options?: { visuals?: Partial<Record<AsteroidType, Texture>> }) {
    this.config = config
    this.view = new Container()
    this.sprite = new Sprite(Texture.WHITE)
    this.sprite.anchor.set(0.5)
    this.view.addChild(this.sprite)
    this.view.visible = false
    if (options?.visuals) this.visuals = options.visuals

    if (ASTEROID_DEBUG_HITBOX) {
      this.debugGfx = new Graphics()
      this.view.addChild(this.debugGfx)
    }

    if (ASTEROID_DEBUG_HP) {
      this.debugHpText = new Text({
        text: '',
        style: {
          fontFamily: 'monospace',
          fontSize: 12,
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 3, alpha: 0.7 },
        },
      })
      this.debugHpText.anchor.set(0.5)
      this.debugHpText.position.set(0, 0)
      this.debugHpText.visible = false
      this.view.addChild(this.debugHpText)
    }
  }

  get contactDamage() { return this.config.contactDamage }

  get position() {
    return this.view.position
  }

  setVisuals(visuals: Partial<Record<AsteroidType, Texture>>) {
    this.visuals = visuals
  }

  spawn(options: {
    type: AsteroidType
    x: number
    y: number
    velocityX: number
    velocityY: number
    stageMultiplier: number
    visualScale?: number
  }) {
    const cfg: AsteroidConfig = this.config.types[options.type]
    const stageMultiplier = options.stageMultiplier
    const scaledHp = Math.max(1, Math.ceil(cfg.hp * stageMultiplier))
    this.active = true
    this.type = options.type
    this.radius = cfg.radius
    this.visualScale = typeof options.visualScale === 'number' ? Math.max(0.05, options.visualScale) : 1
    this.hp = scaledHp
    this.maxHp = scaledHp
    this.vx = options.velocityX
    this.vy = options.velocityY

    this.view.position.set(options.x, options.y)
    this.view.visible = true
    if (this.debugHpText) {
      this.debugHpText.text = String(this.hp)
      this.debugHpText.visible = true
    }

    this.sprite.texture = this.visuals[options.type] ?? Texture.WHITE
    const baseSize = Math.max(1, Math.max(this.sprite.texture.width, this.sprite.texture.height))
    const targetSize = this.radius * 2 * this.visualScale
    const scale = targetSize / baseSize
    this.sprite.scale.set(scale)

    this.redrawDebugHitbox()
  }

  update(dtMs: number) {
    if (!this.active) return
    this.view.position.x += (this.vx * dtMs) / 1000
    this.view.position.y += (this.vy * dtMs) / 1000
  }

  takeDamage(amount: number) {
    this.hp -= amount
    if (this.debugHpText) this.debugHpText.text = String(Math.max(0, this.hp))
  }

  isDead() {
    return this.active && this.hp <= 0
  }

  shouldDespawn(viewport: { width: number; height: number }) {
    if (!this.active) return true
    const x = this.view.position.x
    const y = this.view.position.y
    // Culling margin outside the viewport; not a gameplay default.
    const pad = this.radius + 60
    return x < -pad || y < -pad || x > viewport.width + pad || y > viewport.height + pad
  }

  despawn() {
    this.active = false
    this.view.visible = false
    if (this.debugHpText) this.debugHpText.visible = false
  }

  destroy() {
    this.view.destroy({ children: true })
  }

  private redrawDebugHitbox() {
    if (!this.debugGfx) return
    this.debugGfx.clear()
    this.debugGfx.circle(0, 0, this.radius).stroke({ color: 0xff5555, width: 1, alpha: 0.55 })
  }
}
