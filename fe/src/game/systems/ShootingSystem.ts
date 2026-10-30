import { Container } from 'pixi.js'

import type { Bullet } from '@/game/entities/Bullet'
import { Bullet as BulletEntity } from '@/game/entities/Bullet'
import type { PlayerShip } from '@/game/entities/PlayerShip'
import type { InputSystem } from '@/game/systems/InputSystem'

export function damageAtDistance(baseDamage: number, distPx: number, options?: { startPx?: number; endPx?: number }) {
  const startPx = Math.max(0, Math.round(options?.startPx ?? 120))
  const endPx = Math.max(startPx + 1, Math.round(options?.endPx ?? 520))
  const d = Math.max(0, distPx)
  if (d <= startPx) return Math.max(1, Math.round(baseDamage))
  if (d >= endPx) return 1
  const t = (d - startPx) / (endPx - startPx)
  const out = Math.round(baseDamage * (1 - t))
  return Math.max(1, out)
}

export function getWeaponPrimaryBulletSpec(weaponId: string) {
  if (weaponId === 'shotgun') return { pierceLeft: 0, falloff: { startPx: 90, endPx: 460 } }
  if (weaponId === 'plasma') return { pierceLeft: 3, falloff: null as null }
  return { pierceLeft: 0, falloff: null as null }
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

  private chargedCooldownMs = 900
  private chargedRemainingMs = 0
  private bulletDamage: number
  private chargedDamage: number
  private weaponId: string

  constructor(options: {
    player: PlayerShip
    input: InputSystem
    getViewportSize: () => { width: number; height: number }
    bulletsContainer: Container
    cooldownMs?: number
    bulletDamage?: number
    chargedDamage?: number
    weaponId?: string
  }) {
    this.player = options.player
    this.input = options.input
    this.getViewportSize = options.getViewportSize
    this.bulletsContainer = options.bulletsContainer
    this.cooldownMs = Math.max(40, Math.round(options.cooldownMs ?? 200))
    this.bulletDamage = Math.max(1, Math.round(options.bulletDamage ?? 1))
    this.chargedDamage = Math.max(1, Math.round(options.chargedDamage ?? 8))
    this.weaponId = options.weaponId ?? 'basic_laser'
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
    if (this.weaponId === 'shotgun') {
      const pellets: number = 7
      const spread = 0.46
      const baseDamage = Math.max(1, Math.round(this.bulletDamage))
      for (let i = 0; i < pellets; i += 1) {
        const t = pellets === 1 ? 0.5 : i / (pellets - 1)
        const angle = (-spread / 2 + t * spread) * (0.85 + Math.random() * 0.3)
        const dirX = Math.sin(angle)
        const dirY = -Math.cos(angle)
        this.spawnSingleBullet({
          x,
          y: y - this.player.radius - 6,
          dirX,
          dirY,
          damage: baseDamage,
          color: 0xffb86c,
          falloff: getWeaponPrimaryBulletSpec('shotgun').falloff ?? undefined,
        })
      }
      return
    }

    if (this.weaponId === 'plasma') {
      const spec = getWeaponPrimaryBulletSpec('plasma')
      this.spawnSingleBullet({
        x,
        y: y - this.player.radius - 8,
        dirX: 0,
        dirY: -1,
        damage: Math.max(1, Math.round(this.bulletDamage * 2)),
        color: 0xbd93f9,
        pierceLeft: spec.pierceLeft,
      })
      return
    }

    if (this.weaponId === 'spread_shot') {
      const damage = Math.max(1, Math.ceil(this.bulletDamage / 2))
      this.spawnSingleBullet({ x, y: y - this.player.radius - 6, dirX: -0.22, dirY: -1, damage, color: 0xf1fa8c })
      this.spawnSingleBullet({ x, y: y - this.player.radius - 6, dirX: 0, dirY: -1, damage, color: 0xf1fa8c })
      this.spawnSingleBullet({ x, y: y - this.player.radius - 6, dirX: 0.22, dirY: -1, damage, color: 0xf1fa8c })
      return
    }

    this.spawnSingleBullet({ x, y: y - this.player.radius - 6, dirX: 0, dirY: -1, damage: this.bulletDamage, color: 0xf8f8f2 })
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
      speed: 920,
      lifetimeMs: 700,
      damage: args.damage,
      radius: 4,
      color: args.color,
      falloff: args.falloff,
      pierceLeft: args.pierceLeft,
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
      y: y - this.player.radius - 10,
      directionX: 0,
      directionY: -1,
      speed: 760,
      lifetimeMs: 900,
      damage: this.chargedDamage,
      radius: 10,
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
    if (this.weaponId === 'shotgun') return Math.max(90, Math.round(this.cooldownMs * 1.65))
    if (this.weaponId === 'plasma') return Math.max(120, Math.round(this.cooldownMs * 1.9))
    return this.cooldownMs
  }
}
