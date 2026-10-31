import { Asteroid } from '@/game/entities/Asteroid'
import { SentryTurret } from '@/game/entities/SentryTurret'
import { ShieldDrone } from '@/game/entities/ShieldDrone'
import type { SfxEmitter } from '@/game/audio/audioCatalog'
import type { Bullet } from '@/game/entities/Bullet'
import { MineLayer } from '@/game/entities/MineLayer'
import type { DamageableTarget } from '@/game/entities/Enemy'
import type { DangerZone } from '@/game/entities/DangerZone'
import type { HealZone } from '@/game/entities/HealZone'
import type { PlayerShip } from '@/game/entities/PlayerShip'
import type { ShootingSystem } from '@/game/systems/ShootingSystem'
import type { SpawnSystem } from '@/game/systems/SpawnSystem'
import { haptics } from '@/shared/lib/haptics'

export class CollisionSystem {
  private onSfx?: SfxEmitter
  private player: PlayerShip
  private shooting: ShootingSystem
  private spawns: SpawnSystem
  private onPlayerDamaged: (() => void) | null

  private invulnRemainingMs = 0
  private invulnAfterHitMs: number

  constructor(invulnerabilityMs: number, options: { onSfx?: SfxEmitter; player: PlayerShip; shooting: ShootingSystem; spawns: SpawnSystem; onPlayerDamaged?: () => void }) {
    this.onSfx = options.onSfx
    this.invulnAfterHitMs = invulnerabilityMs
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

    const enemies = this.spawns.getEnemies?.() ?? []
    this.bulletsVsTargets(bullets, asteroids)
    this.bulletsVsTargets(bullets, enemies)
    this.bulletsVsTargets(bullets, this.spawns.getMines?.() ?? [])
    this.minesVsPlayer()
    this.playerVsTargets(asteroids)
    this.playerVsDangerZones(dtMs, dangerZones)
    this.playerVsTargets(enemies)
    this.enemyBulletsVsPlayer()
    this.playerVsHealZones(dtMs, healZones)
  }

  private bulletsVsTargets(bullets: Bullet[], targets: readonly DamageableTarget[]) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i]
      if (!bullet.active) continue

      for (let j = targets.length - 1; j >= 0; j -= 1) {
        const target = targets[j]
        if (!target.active) continue
        if (bullet.hasHitTarget(target)) continue
        if (!circlesOverlap(bullet.view.position.x, bullet.view.position.y, bullet.radius, target.position.x, target.position.y, target.radius))
          continue

        const shieldHit = target instanceof SentryTurret && target.isShielded
        const protecting = target instanceof ShieldDrone && target.turret && target.isProtecting(target.turret)
        const hp = target.hp
        target.takeDamage(bullet.getDamageAtImpact())
        if (target.hp < hp) {
          if (shieldHit) this.onSfx?.('shield_hit')
          if (protecting && target.isDead()) this.onSfx?.('shield_break')
          if (target instanceof Asteroid && !target.isDead()) this.onSfx?.('asteroid_hit')
        }
        bullet.registerTargetHit(target)

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

  private playerVsTargets(targets: readonly DamageableTarget[]) {
    if (this.invulnRemainingMs > 0) return
    if (this.player.hp <= 0) return

    for (const target of targets) {
      if (!target.active) continue
      if (target instanceof MineLayer && !target.canDamagePlayer) continue
      if (!this.player.intersectsCircle(target.position.x, target.position.y, target.radius)) continue

      this.damagePlayer(target.contactDamage)
      return
    }
  }

  private damagePlayer(damage: number) {
    if (this.invulnRemainingMs > 0 || this.player.hp <= 0) return
    const previousHp = this.player.hp
    this.player.hp = Math.max(0, this.player.hp - damage)
    haptics.damage()
    this.onPlayerDamaged?.()
    if (this.player.hp < previousHp) this.onSfx?.('player_hit')
    this.invulnRemainingMs = this.invulnAfterHitMs
  }

  private minesVsPlayer() {
    for (const mine of this.spawns.getMines?.() ?? []) {
      if (mine.state !== 'armed') continue
      const contact = this.player.intersectsCircle(mine.position.x, mine.position.y, mine.radius)
      if (!mine.fuseExpired && !contact) continue
      if (mine.detonate()) {
        this.onSfx?.('mine_explosion')
        if (this.player.intersectsCircle(mine.position.x, mine.position.y, mine.config.blastRadius)) this.damagePlayer(mine.config.damage)
      }
    }
  }

  private enemyBulletsVsPlayer() {
    const bullets = this.spawns.getEnemyBullets?.() ?? []
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i]
      if (!bullet.active || !this.player.intersectsCircle(bullet.view.position.x, bullet.view.position.y, bullet.radius)) continue
      this.spawns.despawnEnemyBullet(bullet)
      this.damagePlayer(bullet.getDamageAtImpact())
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
        const previousHp = this.player.hp
        this.player.hp = Math.max(0, this.player.hp - zone.amount)
        haptics.damage()
        this.onPlayerDamaged?.()
        if (this.player.hp < previousHp) this.onSfx?.('hazard_damage')
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
        const previousHp = this.player.hp
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + zone.amount)
        if (this.player.hp > previousHp) this.onSfx?.('healing')
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
