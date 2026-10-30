import type { Bullet } from '@/game/entities/Bullet'
import type { Asteroid } from '@/game/entities/Asteroid'
import type { DangerZone } from '@/game/entities/DangerZone'
import type { HealZone } from '@/game/entities/HealZone'
import type { PlayerShip } from '@/game/entities/PlayerShip'
import type { ShootingSystem } from '@/game/systems/ShootingSystem'
import type { SpawnSystem } from '@/game/systems/SpawnSystem'
import { haptics } from '@/shared/lib/haptics'

export class CollisionSystem {
  private player: PlayerShip
  private shooting: ShootingSystem
  private spawns: SpawnSystem
  private onPlayerDamaged: (() => void) | null

  private invulnRemainingMs = 0
  private invulnAfterHitMs = 450

  constructor(options: { player: PlayerShip; shooting: ShootingSystem; spawns: SpawnSystem; onPlayerDamaged?: () => void }) {
    this.player = options.player
    this.shooting = options.shooting
    this.spawns = options.spawns
    this.onPlayerDamaged = options.onPlayerDamaged ?? null
  }

  update(dtMs: number) {
    this.invulnRemainingMs = Math.max(0, this.invulnRemainingMs - dtMs)

    const bullets = this.shooting.getBullets()
    const asteroids = this.spawns.getAsteroids()
    const dangerZones = this.spawns.getDangerZones()
    const healZones = this.spawns.getHealZones?.() ?? []

    this.bulletsVsAsteroids(bullets, asteroids)
    this.playerVsAsteroids(asteroids)
    this.playerVsDangerZones(dtMs, dangerZones)
    this.playerVsHealZones(dtMs, healZones)
  }

  private bulletsVsAsteroids(bullets: Bullet[], asteroids: Asteroid[]) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i]
      if (!bullet.active) continue

      for (let j = asteroids.length - 1; j >= 0; j -= 1) {
        const asteroid = asteroids[j]
        if (!asteroid.active) continue
        if (bullet.hasHitAsteroid(asteroid)) continue
        if (!circlesOverlap(bullet.view.position.x, bullet.view.position.y, bullet.radius, asteroid.view.position.x, asteroid.view.position.y, asteroid.radius))
          continue

        asteroid.takeDamage(bullet.getDamageAtImpact())
        bullet.registerAsteroidHit(asteroid)

        if (bullet.pierceLeft > 0) {
          bullet.pierceLeft -= 1
          if (bullet.pierceLeft <= 0) {
            this.shooting.despawnBullet(bullet)
            break
          }
          continue
        }

        this.shooting.despawnBullet(bullet)
        break
      }
    }
  }

  private playerVsAsteroids(asteroids: Asteroid[]) {
    if (this.invulnRemainingMs > 0) return
    if (this.player.hp <= 0) return

    for (const asteroid of asteroids) {
      if (!asteroid.active) continue
      if (!this.player.intersectsCircle(asteroid.view.position.x, asteroid.view.position.y, asteroid.radius)) continue

      this.player.hp = Math.max(0, this.player.hp - 1)
      haptics.damage()
      this.onPlayerDamaged?.()
      this.invulnRemainingMs = this.invulnAfterHitMs
      return
    }
  }

  private playerVsDangerZones(dtMs: number, dangerZones: DangerZone[]) {
    if (this.player.hp <= 0) return
    if (dangerZones.length === 0) return

    for (const zone of dangerZones) {
      if (!zone.active) continue
      if (!this.player.intersectsCircle(zone.view.position.x, zone.view.position.y, zone.radius)) {
        zone.tickAccumMs = 0
        continue
      }

      zone.tickAccumMs += dtMs
      while (zone.tickAccumMs >= zone.damageTickMs) {
        zone.tickAccumMs -= zone.damageTickMs
        if (this.invulnRemainingMs > 0) continue
        if (this.player.hp <= 0) return
        this.player.hp = Math.max(0, this.player.hp - 1)
        haptics.damage()
        this.onPlayerDamaged?.()
        this.invulnRemainingMs = this.invulnAfterHitMs
      }
    }
  }

  private playerVsHealZones(dtMs: number, healZones: HealZone[]) {
    if (this.player.hp <= 0) return
    if (this.player.hp >= this.player.maxHp) return
    if (healZones.length === 0) return

    for (const zone of healZones) {
      if (!zone.active) continue
      if (!this.player.intersectsCircle(zone.view.position.x, zone.view.position.y, zone.radius)) {
        zone.tickAccumMs = 0
        continue
      }

      zone.tickAccumMs += dtMs
      while (zone.tickAccumMs >= zone.healTickMs) {
        zone.tickAccumMs -= zone.healTickMs
        if (this.player.hp <= 0) return
        if (this.player.hp >= this.player.maxHp) return
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1)
      }
    }
  }
}

function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
  const dx = ax - bx
  const dy = ay - by
  const r = ar + br
  return dx * dx + dy * dy <= r * r
}
