import type { PlayerConfig } from '@/game/core/gameplayConfig'
import { AnimatedSprite, Container, Graphics, Sprite, Texture } from 'pixi.js'

export const PLAYER_DEBUG_HITBOX = import.meta.env.DEV

export type PlayerShipVisuals = {
  shipTexture: Texture
  flameTextures: Texture[]
}

const FLAME_ANIMATION_SPEED = 0.28
const SHIP_TARGET_HEIGHT_PX = 44
const FLAME_TARGET_HEIGHT_PX = 26
const FLAME_OVERLAP_PX = 6

export class PlayerShip {
  readonly view: Container
  readonly radius: number
  readonly hitboxRadius: number

  hp: number
  maxHp: number

  readonly pickupRadius: number
  private config: PlayerConfig

  private gfx?: Graphics
  private debugGfx?: Graphics
  private hitboxMode: 'circle' | 'triangle' = 'circle'

  constructor(options: { config: PlayerConfig; maxHp: number; visuals?: PlayerShipVisuals }) {
    this.view = new Container()
    this.config = options.config
    this.radius = options.config.radius
    this.hitboxRadius = options.config.hitboxRadius
    this.pickupRadius = options.config.pickupRadius
    this.maxHp = Math.max(1, Math.round(options.maxHp))
    this.hp = this.maxHp

    const visuals = options?.visuals
    if (visuals) {
      this.hitboxMode = 'triangle'
      const flame = new AnimatedSprite(visuals.flameTextures)
      flame.anchor.set(0.5)
      flame.loop = true
      flame.animationSpeed = FLAME_ANIMATION_SPEED
      flame.play()

      const shipSprite = new Sprite(visuals.shipTexture)
      shipSprite.anchor.set(0.5)

      const shipBaseHeight = shipSprite.height || 1
      const shipScale = SHIP_TARGET_HEIGHT_PX / shipBaseHeight
      shipSprite.scale.set(shipScale)

      const flameBaseHeight = flame.height || 1
      const flameScale = FLAME_TARGET_HEIGHT_PX / flameBaseHeight
      flame.scale.set(flameScale)

      flame.position.set(0, shipSprite.height / 2 + flame.height / 2 - FLAME_OVERLAP_PX)

      this.view.addChild(flame)
      this.view.addChild(shipSprite)
    } else {
      this.gfx = new Graphics()
      this.view.addChild(this.gfx)
      this.redrawFallback()
    }

    if (PLAYER_DEBUG_HITBOX) {
      this.debugGfx = new Graphics()
      this.view.addChild(this.debugGfx)
      this.redrawDebugHitbox()
    }
  }

  intersectsCircle(cx: number, cy: number, cr: number) {
    const px = this.view.position.x
    const py = this.view.position.y

    if (this.hitboxMode === 'circle') {
      const dx = px - cx
      const dy = py - cy
      const r = this.hitboxRadius + cr
      return dx * dx + dy * dy <= r * r
    }

    const ax = px
    const ay = py - this.config.triangleHalfHeight
    const bx = px + this.config.triangleHalfWidth
    const by = py + this.config.triangleHalfHeight
    const cx2 = px - this.config.triangleHalfWidth
    const cy2 = py + this.config.triangleHalfHeight

    if (pointInTriangle(cx, cy, ax, ay, bx, by, cx2, cy2)) return true
    if (distPointToSegmentSq(cx, cy, ax, ay, bx, by) <= cr * cr) return true
    if (distPointToSegmentSq(cx, cy, bx, by, cx2, cy2) <= cr * cr) return true
    if (distPointToSegmentSq(cx, cy, cx2, cy2, ax, ay) <= cr * cr) return true
    return false
  }

  private redrawFallback() {
    if (!this.gfx) return
    // Simple forward-facing triangle ship.
    this.gfx.clear()
    this.gfx
      .poly([
        { x: 0, y: -20 },
        { x: 14, y: 16 },
        { x: 0, y: 10 },
        { x: -14, y: 16 },
      ])
      .fill({ color: 0x8be9fd, alpha: 0.95 })
    this.gfx.circle(0, 12, 6).fill({ color: 0x0b1020, alpha: 0.8 })
  }

  private redrawDebugHitbox() {
    if (!this.debugGfx) return
    this.debugGfx.clear()
    if (this.hitboxMode === 'circle') {
      this.debugGfx.circle(0, 0, this.hitboxRadius).stroke({ color: 0xff5555, width: 1, alpha: 0.55 })
      return
    }

    this.debugGfx
      .poly([
        { x: 0, y: -this.config.triangleHalfHeight },
        { x: this.config.triangleHalfWidth, y: this.config.triangleHalfHeight },
        { x: -this.config.triangleHalfWidth, y: this.config.triangleHalfHeight },
      ])
      .stroke({ color: 0xff5555, width: 1, alpha: 0.55 })
  }

  setPosition(x: number, y: number) {
    this.view.position.set(x, y)
  }

  destroy() {
    this.view.destroy({ children: true })
  }
}

function pointInTriangle(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
) {
  const v0x = cx - ax
  const v0y = cy - ay
  const v1x = bx - ax
  const v1y = by - ay
  const v2x = px - ax
  const v2y = py - ay

  const dot00 = v0x * v0x + v0y * v0y
  const dot01 = v0x * v1x + v0y * v1y
  const dot02 = v0x * v2x + v0y * v2y
  const dot11 = v1x * v1x + v1y * v1y
  const dot12 = v1x * v2x + v1y * v2y

  const denom = dot00 * dot11 - dot01 * dot01
  if (denom === 0) return false
  const invDenom = 1 / denom
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom
  return u >= 0 && v >= 0 && u + v <= 1
}

function distPointToSegmentSq(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay

  const abLenSq = abx * abx + aby * aby
  if (abLenSq === 0) {
    const dx = px - ax
    const dy = py - ay
    return dx * dx + dy * dy
  }

  let t = (apx * abx + apy * aby) / abLenSq
  t = Math.max(0, Math.min(1, t))
  const qx = ax + abx * t
  const qy = ay + aby * t
  const dx = px - qx
  const dy = py - qy
  return dx * dx + dy * dy
}
