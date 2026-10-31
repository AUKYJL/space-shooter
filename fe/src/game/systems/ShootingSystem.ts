import type { WeaponsConfig } from '@/game/core/gameplayConfig'
import type { WeaponId } from '@/shared/lib/weapons'
import { Container } from 'pixi.js'

import type { Bullet } from '@/game/entities/Bullet'
import { Bullet as BulletEntity } from '@/game/entities/Bullet'
import type { PlayerShip } from '@/game/entities/PlayerShip'
import type { InputSystem } from '@/game/systems/InputSystem'

export function damageAtDistance(baseDamage: number, distPx: number, options: { startPx: number; endPx: number }) {
  const startPx = Math.max(0, Math.round(options.startPx))
  const endPx = Math.max(startPx + 1, Math.round(options.endPx))
  const d = Math.max(0, distPx)
  if (d <= startPx) return Math.max(1, Math.round(baseDamage))
  if (d >= endPx) return 1
  const t = (d - startPx) / (endPx - startPx)
  const out = Math.round(baseDamage * (1 - t))
  return Math.max(1, out)
}

export function getWeaponPrimaryBulletSpec(weaponId: WeaponId, config: WeaponsConfig) {
  const variant = config.variants[weaponId]
  if (!variant) throw new Error(`Missing weapon configuration: ${weaponId}`)
  return { pierceLeft: variant.pierce, falloff: variant.falloff }
}

export class ShootingSystem {
  private player: PlayerShip
  private input: InputSystem
  private getViewportSize: () => { width: number; height: number }
  private bulletsContainer: Container

  private cooldownMs: number
  private timeUntilNextShotMs = 0

  private bulletsActive: Bullet[] = []
  private bulletsPool: Bullet[] = []

  private chargedCooldownMs: number
  private chargedRemainingMs = 0
  private bulletDamage: number
  private chargedDamage: number
  private weaponId: WeaponId

  private config: WeaponsConfig

  constructor(config: WeaponsConfig, options: {
    player: PlayerShip
    input: InputSystem
    getViewportSize: () => { width: number; height: number }
    bulletsContainer: Container
    cooldownMs: number
    bulletDamage: number
    chargedDamage: number
    weaponId: WeaponId
  }) {
    this.config = config
    this.chargedCooldownMs = config.charged.cooldownMs
    this.player = options.player
    this.input = options.input
    this.getViewportSize = options.getViewportSize
    this.bulletsContainer = options.bulletsContainer
    this.cooldownMs = options.cooldownMs
    this.bulletDamage = options.bulletDamage
    this.chargedDamage = options.chargedDamage
    this.weaponId = options.weaponId
  }

  update(dtMs: number) {
    this.timeUntilNextShotMs = Math.max(0, this.timeUntilNextShotMs - dtMs)
    this.chargedRemainingMs = Math.max(0, this.chargedRemainingMs - dtMs)

    const fire = this.input.getFireState()
    if (fire.isFiring && this.timeUntilNextShotMs <= 0) {
      this.spawnBullet()
      this.timeUntilNextShotMs = this.getWeaponCooldownMs()
    }

    const viewport = this.getViewportSize()
    for (let i = this.bulletsActive.length - 1; i >= 0; i -= 1) {
      const bullet = this.bulletsActive[i]
      bullet.update(dtMs)
      if (bullet.shouldDespawn(viewport)) {
        bullet.despawn()
        this.bulletsContainer.removeChild(bullet.view)
        this.bulletsActive.splice(i, 1)
        this.bulletsPool.push(bullet)
      }
    }
  }

  private spawnBullet() {
    const { x, y } = this.player.view.position
    const variant = this.config.variants[this.weaponId]
    if (this.weaponId === 'shotgun') {
      const pellets = variant.pellets
      const spread = variant.spread
      const baseDamage = Math.max(1, Math.round(this.bulletDamage))
      for (let i = 0; i < pellets; i += 1) {
        const t = pellets === 1 ? 0.5 : i / (pellets - 1)
        const angle = (-spread / 2 + t * spread) * (variant.jitterMin + Math.random() * variant.jitterRange)
        const dirX = Math.sin(angle)
        const dirY = -Math.cos(angle)
        this.spawnSingleBullet({
          x,
          y: y - this.player.radius - variant.muzzleOffset,
          dirX,
          dirY,
          damage: baseDamage,
          color: 0xffb86c,
          falloff: getWeaponPrimaryBulletSpec('shotgun', this.config).falloff ?? undefined,
        })
      }
      return
    }

    if (this.weaponId === 'plasma') {
      const spec = getWeaponPrimaryBulletSpec('plasma', this.config)
      this.spawnSingleBullet({
        x,
        y: y - this.player.radius - variant.muzzleOffset,
        dirX: 0,
        dirY: -1,
        damage: Math.max(1, Math.round(this.bulletDamage * variant.damageMultiplier)),
        color: 0xbd93f9,
        pierceLeft: spec.pierceLeft,
      })
      return
    }

    if (this.weaponId === 'spread_shot') {
      const damage = Math.max(1, Math.ceil(this.bulletDamage * variant.damageMultiplier))
      this.spawnSingleBullet({ x, y: y - this.player.radius - variant.muzzleOffset, dirX: variant.directions[0], dirY: -1, damage, color: 0xf1fa8c })
      this.spawnSingleBullet({ x, y: y - this.player.radius - variant.muzzleOffset, dirX: variant.directions[1], dirY: -1, damage, color: 0xf1fa8c })
      this.spawnSingleBullet({ x, y: y - this.player.radius - variant.muzzleOffset, dirX: variant.directions[2], dirY: -1, damage, color: 0xf1fa8c })
      return
    }

    this.spawnSingleBullet({ x, y: y - this.player.radius - variant.muzzleOffset, dirX: 0, dirY: -1, damage: this.bulletDamage, color: 0xf8f8f2 })
  }

  private spawnSingleBullet(args: {
    x: number
    y: number
    dirX: number
    dirY: number
    damage: number
    color: number
    falloff?: { startPx: number; endPx: number }
    pierceLeft?: number
  }) {
    const bullet = this.bulletsPool.pop() ?? new BulletEntity()
    bullet.spawn({
      x: args.x,
      y: args.y,
      directionX: args.dirX,
      directionY: args.dirY,
      speed: this.config.primary.speed,
      lifetimeMs: this.config.primary.lifetimeMs,
      damage: args.damage,
      radius: this.config.primary.radius,
      color: args.color,
      falloff: args.falloff ?? this.config.variants[this.weaponId].falloff,
      pierceLeft: args.pierceLeft ?? this.config.variants[this.weaponId].pierce,
    })
    this.bulletsActive.push(bullet)
    this.bulletsContainer.addChild(bullet.view)
  }

  fireChargedShot() {
    if (this.chargedRemainingMs > 0) return
    this.spawnChargedBullet()
    this.chargedRemainingMs = this.chargedCooldownMs
  }

  private spawnChargedBullet() {
    const bullet = this.bulletsPool.pop() ?? new BulletEntity()
    const { x, y } = this.player.view.position
    bullet.spawn({
      x,
      y: y - this.player.radius - this.config.charged.muzzleOffset,
      directionX: 0,
      directionY: -1,
      speed: this.config.charged.speed,
      lifetimeMs: this.config.charged.lifetimeMs,
      pierceLeft: this.config.charged.pierce,
      falloff: null,
      damage: this.chargedDamage,
      radius: this.config.charged.radius,
      color: 0x50fa7b,
    })
    this.bulletsActive.push(bullet)
    this.bulletsContainer.addChild(bullet.view)
  }

  getBullets() {
    return this.bulletsActive
  }

  despawnBullet(bullet: Bullet) {
    const idx = this.bulletsActive.indexOf(bullet)
    if (idx === -1) return
    bullet.despawn()
    this.bulletsContainer.removeChild(bullet.view)
    this.bulletsActive.splice(idx, 1)
    this.bulletsPool.push(bullet)
  }

  destroy() {
    for (const bullet of this.bulletsActive) bullet.destroy()
    for (const bullet of this.bulletsPool) bullet.destroy()
    this.bulletsActive = []
    this.bulletsPool = []
  }

  private getWeaponCooldownMs() {
    const variant = this.config.variants[this.weaponId]
    return Math.max(variant.minCooldownMs, Math.round(this.cooldownMs * variant.cooldownMultiplier))
  }
}
