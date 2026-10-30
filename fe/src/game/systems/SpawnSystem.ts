import { Container } from 'pixi.js'
import { ShieldDrone } from '@/game/entities/ShieldDrone'
import { ShieldDroneView } from '@/game/views/ShieldDroneView'
import { SentryTurret } from '@/game/entities/SentryTurret'
import { SentryTurretView } from '@/game/views/SentryTurretView'
import { Bullet } from '@/game/entities/Bullet'
import type { Position } from '@/game/entities/Enemy'
import type { EnemyConfigs } from '@/game/core/enemyConfig'

import type { Asteroid, AsteroidType } from '@/game/entities/Asteroid'
import { Asteroid as AsteroidEntity, getAsteroidConfig } from '@/game/entities/Asteroid'
import type { AsteroidAssets } from '@/game/assets/loadAsteroidAssets'
import type { DangerZone } from '@/game/entities/DangerZone'
import { DangerZone as DangerZoneEntity } from '@/game/entities/DangerZone'
import type { HealZone } from '@/game/entities/HealZone'
import { HealZone as HealZoneEntity } from '@/game/entities/HealZone'

export type SpawnTuning = {
  maxActive: number
  spawnEveryMs: number
  typeWeights: Record<AsteroidType, number>
  stageMultiplier: number
}

export type AsteroidVisualTuning = {
  scale?: number
  scaleByType?: Partial<Record<AsteroidType, number>>
}

export class SpawnSystem {
  private container: Container
  private getViewportSize: () => { width: number; height: number }
  private getPlayerPosition?: () => { x: number; y: number }
  private onAsteroidDestroyed?: (asteroid: Asteroid) => void
  private asteroidVisuals?: AsteroidAssets
  private zonesContainer: Container
  private rng: () => number

  private enemyConfig?: EnemyConfigs
  private dronePool: ShieldDrone[] = []
  private droneViews = new Map<ShieldDrone, ShieldDroneView>()
  private onEnemyDestroyed?: (enemy: SentryTurret | ShieldDrone) => void
  private enemies: (SentryTurret | ShieldDrone)[] = []
  private enemyPool: SentryTurret[] = []
  private enemyViews = new Map<SentryTurret, SentryTurretView>()
  private enemyBullets: Bullet[] = []
  private enemyBulletPool: Bullet[] = []
  private enemyStage = 0
  private enemyStageMultiplier = 1
  private enemyGateJustOpened = false
  private enemySpawnRemainingMs = 0

  private maxActive = 26
  private spawnEveryMs = 420
  private timeUntilSpawnMs = 0
  private typeWeights: Record<AsteroidType, number> = {
    normal: 0.65,
    fast: 0.17,
    big: 0.12,
    armored: 0.06,
  }
  private stageMultiplier = 1
  private asteroidVisualScale = 1
  private asteroidVisualScaleByType: Partial<Record<AsteroidType, number>> = {}

  private active: Asteroid[] = []
  private pool: Asteroid[] = []

  private dangerZonesActive: DangerZone[] = []
  private dangerZonesPool: DangerZone[] = []
  private timeUntilDangerZoneMs = 4500
  private healZonesActive: HealZone[] = []
  private healZonesPool: HealZone[] = []
  private timeUntilHealZoneMs = 7200

  constructor(options: {
    container: Container
    getViewportSize: () => { width: number; height: number }
    getPlayerPosition?: () => { x: number; y: number }
    onAsteroidDestroyed?: (asteroid: Asteroid) => void
    asteroidVisuals?: AsteroidAssets
    asteroidVisualTuning?: AsteroidVisualTuning
    rng?: () => number
    enemies?: EnemyConfigs
    onEnemyDestroyed?: (enemy: SentryTurret | ShieldDrone) => void
  }) {
    this.enemyConfig = options.enemies ? structuredClone(options.enemies) : undefined
    this.onEnemyDestroyed = options.onEnemyDestroyed
    this.container = options.container
    this.zonesContainer = new Container()
    this.container.addChild(this.zonesContainer)
    this.getViewportSize = options.getViewportSize
    this.getPlayerPosition = options.getPlayerPosition
    this.onAsteroidDestroyed = options.onAsteroidDestroyed
    this.asteroidVisuals = options.asteroidVisuals
    this.rng = options.rng ?? Math.random
    if (options.asteroidVisualTuning) this.setAsteroidVisualTuning(options.asteroidVisualTuning)
  }

  update(dtMs: number) {
    this.updateEnemies(dtMs)
    this.timeUntilSpawnMs = Math.max(0, this.timeUntilSpawnMs - dtMs)
    this.timeUntilDangerZoneMs = Math.max(0, this.timeUntilDangerZoneMs - dtMs)
    this.timeUntilHealZoneMs = Math.max(0, this.timeUntilHealZoneMs - dtMs)

    if (this.active.length < this.maxActive && this.timeUntilSpawnMs <= 0) {
      this.spawnOne()
      this.timeUntilSpawnMs = this.spawnEveryMs
    }

    if (this.timeUntilDangerZoneMs <= 0) {
      this.maybeSpawnDangerZone()
      this.timeUntilDangerZoneMs = 4500 + this.rng() * 3500
    }

    if (this.timeUntilHealZoneMs <= 0) {
      this.maybeSpawnHealZone()
      this.timeUntilHealZoneMs = 7200 + this.rng() * 4200
    }

    const viewport = this.getViewportSize()
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const asteroid = this.active[i]
      asteroid.update(dtMs)
      if (asteroid.isDead()) {
        this.onAsteroidDestroyed?.(asteroid)
        this.despawnAt(i)
        continue
      }
      if (asteroid.shouldDespawn(viewport)) {
        this.despawnAt(i)
      }
    }

    for (let i = this.dangerZonesActive.length - 1; i >= 0; i -= 1) {
      const zone = this.dangerZonesActive[i]
      zone.update(dtMs)
      if (!zone.active) {
        this.zonesContainer.removeChild(zone.view)
        this.dangerZonesActive.splice(i, 1)
        this.dangerZonesPool.push(zone)
      }
    }

    for (let i = this.healZonesActive.length - 1; i >= 0; i -= 1) {
      const zone = this.healZonesActive[i]
      zone.update(dtMs)
      if (!zone.active) {
        this.zonesContainer.removeChild(zone.view)
        this.healZonesActive.splice(i, 1)
        this.healZonesPool.push(zone)
      }
    }
  }

  setEnemyStage(stage: number, multiplier: number) {
    const rule = this.enemyConfig?.sentryTurret
    const minStage = rule?.minStage ?? Infinity
    if (rule && this.enemyStage < minStage && stage >= minStage) {
      this.enemySpawnRemainingMs = rule.firstSpawnDelayMs
      this.enemyGateJustOpened = true
    }
    this.enemyStage = stage
    this.enemyStageMultiplier = multiplier
  }

  getEnemies() { return this.enemies }
  getEnemyBullets() { return this.enemyBullets }

  private updateEnemies(dtMs: number) {
    const viewport = this.getViewportSize()
    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.enemyBullets[i]
      bullet.update(dtMs)
      if (bullet.shouldDespawn(viewport)) this.despawnEnemyBullet(bullet)
    }
    const player = this.getPlayerPosition?.() ?? { x: viewport.width / 2, y: viewport.height }
    for (const enemy of this.enemies) {
      if (enemy.type === 'sentryTurret') {
        const direction = enemy.update(dtMs, player)
        if (direction) this.fireEnemyBullet(enemy, direction)
      } else {
        enemy.update(dtMs, viewport)
      }
    }
    this.resolveDestroyedEnemies()
    const rule = this.enemyConfig?.sentryTurret
    if (!rule || this.enemyStage < rule.minStage) return
    // Stage changes are observed at the end of a frame: don't count that frame twice.
    if (this.enemyGateJustOpened) {
      this.enemyGateJustOpened = false
      return
    }
    this.enemySpawnRemainingMs = Math.max(0, this.enemySpawnRemainingMs - dtMs)
    if (this.enemySpawnRemainingMs > 0 || this.enemies.filter((enemy) => enemy.type === 'sentryTurret').length >= rule.maxActive) return
    if (viewport.width <= 0 || viewport.height <= 0) return
    this.enemySpawnRemainingMs = rule.spawnEveryMs
    if (this.rng() >= rule.spawnChance) return
    const turretConfig = rule
    const margin = Math.min(turretConfig.edgeMargin, viewport.width / 2)
    const x = margin + this.rng() * Math.max(0, viewport.width - margin * 2)
    const stopY = Math.min(viewport.height / 2, Math.max(turretConfig.radius, viewport.height * turretConfig.stopHeightRatio))
    const enemy = this.enemyPool.pop() ?? new SentryTurret(turretConfig)
    if (!this.enemyViews.has(enemy)) this.enemyViews.set(enemy, new SentryTurretView(turretConfig, this.enemyConfig!.shieldDrone))
    enemy.spawn(x, stopY, this.enemyStageMultiplier)
    const visual = this.enemyViews.get(enemy)!
    visual.sync(enemy)
    this.container.addChild(visual.view)
    this.enemies.push(enemy)
    const droneRule = this.enemyConfig?.shieldDrone
    if (droneRule && this.enemyStage >= droneRule.minStage
      && this.enemies.filter((item) => item.type === 'shieldDrone').length < droneRule.maxActive
      && this.rng() < droneRule.spawnChance) {
      const drone = this.dronePool.pop() ?? new ShieldDrone(droneRule)
      if (!this.droneViews.has(drone)) this.droneViews.set(drone, new ShieldDroneView(droneRule))
      drone.spawn(enemy, this.enemyStageMultiplier, viewport)
      const droneVisual = this.droneViews.get(drone)!
      droneVisual.sync(drone)
      visual.sync(enemy)
      this.container.addChild(droneVisual.view)
      this.enemies.push(drone)
    }
  }

  private fireEnemyBullet(enemy: SentryTurret, direction: Position) {
    const cfg = enemy.config.bullet
    if (this.enemyBullets.length >= cfg.maxActive) return
    const bullet = this.enemyBulletPool.pop() ?? new Bullet()
    bullet.spawn({ x: enemy.position.x, y: enemy.position.y,
      directionX: direction.x, directionY: direction.y,
      speed: cfg.speed, radius: cfg.radius, damage: cfg.damage,
      lifetimeMs: cfg.lifetimeMs, color: cfg.color })
    this.enemyBullets.push(bullet)
    this.container.addChild(bullet.view)
  }

  despawnEnemyBullet(bullet: Bullet) {
    const index = this.enemyBullets.indexOf(bullet)
    if (index < 0) return
    bullet.despawn()
    this.container.removeChild(bullet.view)
    this.enemyBullets.splice(index, 1)
    this.enemyBulletPool.push(bullet)
  }

  resolveDestroyedEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i]
      if (enemy.active) continue
      if (enemy.isDead()) this.onEnemyDestroyed?.(enemy)
      if (enemy.type === 'sentryTurret') {
        enemy.shieldDrone?.leave()
        this.container.removeChild(this.enemyViews.get(enemy)!.view)
        this.enemyPool.push(enemy)
      } else {
        enemy.detach()
        this.container.removeChild(this.droneViews.get(enemy)!.view)
        this.dronePool.push(enemy)
      }
      this.enemies.splice(i, 1)
    }
    // Also runs after collisions: shield visuals reflect lethal hits this frame.
    for (const enemy of this.enemies) {
      if (enemy.type === 'sentryTurret') this.enemyViews.get(enemy)!.sync(enemy)
      else this.droneViews.get(enemy)!.sync(enemy)
    }
  }

  clearEnemies() {
    for (const enemy of this.enemies) {
      if (enemy.type === 'sentryTurret') enemy.shieldDrone?.leave()
      else enemy.detach()
      enemy.state = 'inactive'
    }
    for (const visual of this.droneViews.values()) visual.destroy()
    this.droneViews.clear()
    this.dronePool = []
    for (const visual of this.enemyViews.values()) visual.destroy()
    for (const bullet of [...this.enemyBullets, ...this.enemyBulletPool]) bullet.destroy()
    this.enemyViews.clear()
    this.enemies = []
    this.enemyPool = []
    this.enemyBullets = []
    this.enemyBulletPool = []
  }

  private despawnAt(index: number) {
    const asteroid = this.active[index]
    asteroid.despawn()
    this.container.removeChild(asteroid.view)
    this.active.splice(index, 1)
    this.pool.push(asteroid)
  }

  private spawnOne() {
    const viewport = this.getViewportSize()
    if (viewport.width <= 0 || viewport.height <= 0) return

    const type = this.rollType()
    const cfg = getAsteroidConfig(type)

    const edge = this.rollSpawnEdge()
    const pad = cfg.radius + 12

    let x = 0
    let y = 0
    if (edge === 0) {
      x = this.rng() * viewport.width
      y = -pad
    } else if (edge === 1) {
      x = viewport.width + pad
      y = this.rng() * viewport.height
    } else if (edge === 2) {
      x = this.rng() * viewport.width
      y = viewport.height + pad
    } else {
      x = -pad
      y = this.rng() * viewport.height
    }

    const target = this.pickTarget(viewport)
    const targetX = target.x
    const targetY = target.y
    const dirX = targetX - x
    const dirY = targetY - y
    const len = Math.hypot(dirX, dirY) || 1

    const speed = cfg.speed * (0.85 + this.rng() * 0.3)
    const vx = (dirX / len) * speed
    const vy = (dirY / len) * speed

    const asteroid = this.pool.pop() ?? new AsteroidEntity({ visuals: this.asteroidVisuals })
    if (this.asteroidVisuals) asteroid.setVisuals(this.asteroidVisuals)
    const visualScale = this.asteroidVisualScaleByType[type] ?? this.asteroidVisualScale
    asteroid.spawn({ type, x, y, velocityX: vx, velocityY: vy, stageMultiplier: this.stageMultiplier, visualScale })
    this.active.push(asteroid)
    this.container.addChild(asteroid.view)
  }

  getAsteroids() {
    return this.active
  }

  getDangerZones() {
    return this.dangerZonesActive
  }

  getHealZones() {
    return this.healZonesActive
  }

  setTuning(next: Partial<SpawnTuning>) {
    if (typeof next.maxActive === 'number') this.maxActive = Math.max(1, Math.floor(next.maxActive))
    if (typeof next.spawnEveryMs === 'number') this.spawnEveryMs = Math.max(60, Math.floor(next.spawnEveryMs))
    if (next.typeWeights) this.typeWeights = normalizeWeights(next.typeWeights)
    if (typeof next.stageMultiplier === 'number') this.stageMultiplier = Math.max(0.1, next.stageMultiplier)
  }

  setAsteroidVisualTuning(next: AsteroidVisualTuning) {
    if (typeof next.scale === 'number') this.asteroidVisualScale = Math.max(0.05, next.scale)
    if (next.scaleByType) this.asteroidVisualScaleByType = { ...next.scaleByType }
  }

  destroy() {
    this.clearEnemies()
    for (const asteroid of this.active) asteroid.destroy()
    for (const asteroid of this.pool) asteroid.destroy()
    for (const zone of this.dangerZonesActive) zone.destroy()
    for (const zone of this.dangerZonesPool) zone.destroy()
    for (const zone of this.healZonesActive) zone.destroy()
    for (const zone of this.healZonesPool) zone.destroy()
    this.active = []
    this.pool = []
    this.dangerZonesActive = []
    this.dangerZonesPool = []
    this.healZonesActive = []
    this.healZonesPool = []
  }

  private rollType(): AsteroidType {
    const weights = this.typeWeights
    const total = weights.normal + weights.fast + weights.big + weights.armored
    if (!(total > 0)) return 'normal'

    const r = this.rng() * total
    if (r < weights.normal) return 'normal'
    if (r < weights.normal + weights.fast) return 'fast'
    if (r < weights.normal + weights.fast + weights.big) return 'big'
    return 'armored'
  }

  private rollSpawnEdge() {
    // 0=top, 1=right, 2=bottom, 3=left
    // Anti-camp: favor spawns coming "from above" (top) and reduce bottom spawns.
    const wTop = 0.46
    const wRight = 0.22
    const wBottom = 0.12
    const wLeft = 0.2
    const total = wTop + wRight + wBottom + wLeft
    const r = this.rng() * total
    if (r < wTop) return 0
    if (r < wTop + wRight) return 1
    if (r < wTop + wRight + wBottom) return 2
    return 3
  }

  private pickTarget(viewport: { width: number; height: number }) {
    const player = this.getPlayerPosition?.()
    const stageT = Math.max(0, Math.min(1, (this.stageMultiplier - 1) / 1))
    const targetPlayerChance = Math.min(0.22, 0.08 + stageT * 0.12)

    if (player && this.rng() < targetPlayerChance) {
      const x = Math.max(24, Math.min(viewport.width - 24, player.x))
      const y = Math.max(24, Math.min(viewport.height - 24, player.y))
      return { x, y }
    }

    return {
      x: viewport.width * (0.2 + this.rng() * 0.6),
      y: viewport.height * (0.2 + this.rng() * 0.6),
    }
  }

  private maybeSpawnDangerZone() {
    if (this.dangerZonesActive.length >= 2) return
    if (this.rng() > 0.35) return

    const viewport = this.getViewportSize()
    if (viewport.width <= 0 || viewport.height <= 0) return

    const pad = 90
    const x = pad + this.rng() * Math.max(1, viewport.width - pad * 2)
    const y = pad + this.rng() * Math.max(1, viewport.height - pad * 2)

    const zone = this.dangerZonesPool.pop() ?? new DangerZoneEntity()
    zone.spawn({ x, y, ttlMs: 10_000, radius: 54 })
    this.dangerZonesActive.push(zone)
    this.zonesContainer.addChild(zone.view)
  }

  private maybeSpawnHealZone() {
    if (this.healZonesActive.length >= 1) return
    if (this.rng() > 0.22) return

    const viewport = this.getViewportSize()
    if (viewport.width <= 0 || viewport.height <= 0) return

    const pad = 90
    const x = pad + this.rng() * Math.max(1, viewport.width - pad * 2)
    const y = pad + this.rng() * Math.max(1, viewport.height - pad * 2)

    const zone = this.healZonesPool.pop() ?? new HealZoneEntity()
    zone.spawn({ x, y, ttlMs: 5_000, radius: 46 })
    this.healZonesActive.push(zone)
    this.zonesContainer.addChild(zone.view)
  }
}

function normalizeWeights(weights: Record<AsteroidType, number>): Record<AsteroidType, number> {
  const next: Record<AsteroidType, number> = {
    normal: Math.max(0, weights.normal ?? 0),
    fast: Math.max(0, weights.fast ?? 0),
    big: Math.max(0, weights.big ?? 0),
    armored: Math.max(0, weights.armored ?? 0),
  }

  const total = next.normal + next.fast + next.big + next.armored
  if (!(total > 0)) return { normal: 1, fast: 0, big: 0, armored: 0 }

  next.normal /= total
  next.fast /= total
  next.big /= total
  next.armored /= total
  return next
}
