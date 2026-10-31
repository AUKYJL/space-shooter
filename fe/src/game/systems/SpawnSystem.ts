import type { SfxEmitter } from '@/game/audio/audioCatalog'
import type { GameplayConfig } from '@/game/core/gameplayConfig'
import { DifficultySystem } from './DifficultySystem'
import { Container } from 'pixi.js'
import { ShieldDrone } from '@/game/entities/ShieldDrone'
import { ShieldDroneView } from '@/game/views/ShieldDroneView'
import { SentryTurret } from '@/game/entities/SentryTurret'
import { SentryTurretView } from '@/game/views/SentryTurretView'
import { MineLayer } from '@/game/entities/MineLayer'
import { Mine } from '@/game/entities/Mine'
import { MineLayerView } from '@/game/views/MineLayerView'
import { MineView } from '@/game/views/MineView'
import { Bullet } from '@/game/entities/Bullet'
import type { Position } from '@/game/entities/Enemy'
import type { EnemyConfigs } from '@/game/core/enemyConfig'

import type { Asteroid, AsteroidType } from '@/game/entities/Asteroid'
import { Asteroid as AsteroidEntity } from '@/game/entities/Asteroid'
import type { EnemyAssets } from '@/game/assets/loadEnemyAssets'
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
  private onSfx?: SfxEmitter
  private container: Container
  private getViewportSize: () => { width: number; height: number }
  private getPlayerPosition: () => { x: number; y: number }
  private onAsteroidDestroyed?: (asteroid: Asteroid) => void
  private enemyAssets: EnemyAssets
  private asteroidVisuals?: AsteroidAssets
  private zonesContainer: Container
  private rng: () => number

  private enemyConfig: Required<EnemyConfigs>
  private dronePool: ShieldDrone[] = []
  private droneViews = new Map<ShieldDrone, ShieldDroneView>()
  private onEnemyDestroyed?: (enemy: SentryTurret | ShieldDrone | MineLayer) => void
  private enemies: (SentryTurret | ShieldDrone | MineLayer)[] = []
  private enemyPool: SentryTurret[] = []
  private protectedTurrets = new Set<SentryTurret>()
  private enemyViews = new Map<SentryTurret, SentryTurretView>()
  private enemyBullets: Bullet[] = []
  private enemyBulletPool: Bullet[] = []
  private mineLayerPool: MineLayer[] = []
  private mineLayerViews = new Map<MineLayer, MineLayerView>()
  private mines: Mine[] = []
  private minePool: Mine[] = []
  private mineViews = new Map<Mine, MineView>()
  private mineLayerGateJustOpened = false
  private mineLayerSpawnRemainingMs = 0
  private enemyStage = 0
  private enemyStageMultiplier = 1
  private enemyGateJustOpened = false
  private enemySpawnRemainingMs = 0

  private maxActive: number
  private spawnEveryMs: number
  private timeUntilSpawnMs = 0
  private typeWeights: Record<AsteroidType, number>
  private stageMultiplier = 1
  private asteroidVisualScale = 1
  private asteroidVisualScaleByType: Partial<Record<AsteroidType, number>> = {}

  private active: Asteroid[] = []
  private pool: Asteroid[] = []

  private dangerZonesActive: DangerZone[] = []
  private dangerZonesPool: DangerZone[] = []
  private timeUntilDangerZoneMs: number
  private healZonesActive: HealZone[] = []
  private healZonesPool: HealZone[] = []
  private timeUntilHealZoneMs: number

  private config: GameplayConfig

  constructor(config: GameplayConfig, options: {
    onSfx?: SfxEmitter
    container: Container
    getViewportSize: () => { width: number; height: number }
    getPlayerPosition: () => { x: number; y: number }
    onAsteroidDestroyed?: (asteroid: Asteroid) => void
    enemyAssets: EnemyAssets
    asteroidVisuals?: AsteroidAssets
    asteroidVisualTuning?: AsteroidVisualTuning
    rng?: () => number
    enemies: EnemyConfigs
    onEnemyDestroyed?: (enemy: SentryTurret | ShieldDrone | MineLayer) => void
  }) {
    this.onSfx = options.onSfx
    this.config = config
    if (!options.enemies?.sentryTurret || !options.enemies.shieldDrone || !options.enemies.mineLayer) throw new Error('Missing enemy configuration')
    this.enemyConfig = structuredClone(options.enemies) as Required<EnemyConfigs>
    const tuning = new DifficultySystem(config.difficulty).getSpawnTuning()
    this.maxActive = Math.max(1, Math.floor(tuning.maxActive))
    this.spawnEveryMs = Math.max(config.spawn.minSpawnEveryMs, Math.floor(tuning.spawnEveryMs))
    this.typeWeights = normalizeWeights(tuning.typeWeights)
    this.timeUntilDangerZoneMs = config.zones.danger.firstSpawnMs
    this.timeUntilHealZoneMs = config.zones.heal.firstSpawnMs
    this.onEnemyDestroyed = options.onEnemyDestroyed
    this.container = options.container
    this.zonesContainer = new Container()
    this.container.addChild(this.zonesContainer)
    this.getViewportSize = options.getViewportSize
    this.getPlayerPosition = options.getPlayerPosition
    this.onAsteroidDestroyed = options.onAsteroidDestroyed
    this.enemyAssets = options.enemyAssets
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
      this.timeUntilDangerZoneMs = this.config.zones.danger.spawnEveryMs + this.rng() * this.config.zones.danger.spawnJitterMs
    }

    if (this.timeUntilHealZoneMs <= 0) {
      this.maybeSpawnHealZone()
      this.timeUntilHealZoneMs = this.config.zones.heal.spawnEveryMs + this.rng() * this.config.zones.heal.spawnJitterMs
    }

    const viewport = this.getViewportSize()
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const asteroid = this.active[i]
      asteroid.update(dtMs)
      if (asteroid.isDead()) {
        this.onSfx?.(asteroid.type === 'big' || asteroid.type === 'armored' ? 'asteroid_explosion' : 'asteroid_break')
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
    const rule = this.enemyConfig.sentryTurret
    const minStage = rule.minStage
    if (this.enemyStage < minStage && stage >= minStage) {
      this.enemySpawnRemainingMs = rule.firstSpawnDelayMs
      this.enemyGateJustOpened = true
    }
    const mineRule = this.enemyConfig.mineLayer
    if (this.enemyStage < mineRule.minStage && stage >= mineRule.minStage) {
      this.mineLayerSpawnRemainingMs = mineRule.firstSpawnDelayMs
      this.mineLayerGateJustOpened = true
    }
    this.enemyStage = stage
    this.enemyStageMultiplier = multiplier
  }

  getEnemies() { return this.enemies }
  getEnemyBullets() { return this.enemyBullets }
  getMines() { return this.mines }

  private updateEnemies(dtMs: number) {
    const viewport = this.getViewportSize()
    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.enemyBullets[i]
      bullet.update(dtMs)
      if (bullet.shouldDespawn(viewport)) this.despawnEnemyBullet(bullet)
    }
    const player = this.getPlayerPosition()
    // Age existing mines before ship updates create new ones.
    for (const mine of this.mines) {
      const previous = mine.state
      mine.update(dtMs)
      if (previous === 'dormant' && mine.state === 'armed') this.onSfx?.('mine_armed')
    }
    for (const enemy of this.enemies) {
      if (enemy.type === 'sentryTurret') {
        const entering = enemy.state === 'entering'
        const direction = enemy.update(dtMs, player)
        if (entering && enemy.state === 'active') this.onSfx?.('turret_lock')
        if (direction) this.fireEnemyBullet(enemy, direction)
      } else if (enemy.type === 'mineLayer') {
        const drop = enemy.update(dtMs)
        if (drop) this.dropMine(drop)
      } else {
        enemy.update(dtMs, viewport)
      }
    }
    this.resolveDestroyedEnemies()
    this.spawnMineLayer(dtMs, viewport)
    const rule = this.enemyConfig.sentryTurret
    if (this.enemyStage < rule.minStage) return
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
    if (!this.enemyViews.has(enemy)) this.enemyViews.set(enemy, new SentryTurretView(turretConfig, this.enemyConfig!.shieldDrone, this.enemyAssets))
    enemy.spawn(x, stopY, this.enemyStageMultiplier)
    this.onSfx?.('turret_deploy')
    const visual = this.enemyViews.get(enemy)!
    visual.sync(enemy)
    this.container.addChild(visual.view)
    this.enemies.push(enemy)
    const droneRule = this.enemyConfig.shieldDrone
    if (this.enemyStage >= droneRule.minStage
      && this.enemies.filter((item) => item.type === 'shieldDrone').length < droneRule.maxActive
      && this.rng() < droneRule.spawnChance) {
      const drone = this.dronePool.pop() ?? new ShieldDrone(droneRule)
      if (!this.droneViews.has(drone)) this.droneViews.set(drone, new ShieldDroneView(droneRule, this.enemyAssets.shieldDrone))
      drone.spawn(enemy, this.enemyStageMultiplier, viewport)
      const droneVisual = this.droneViews.get(drone)!
      droneVisual.sync(drone)
      visual.sync(enemy)
      this.container.addChild(droneVisual.view)
      this.enemies.push(drone)
    }
  }

  private spawnMineLayer(dtMs: number, viewport: { width: number; height: number }) {
    const cfg = this.enemyConfig.mineLayer
    if (this.enemyStage < cfg.minStage) return
    if (this.mineLayerGateJustOpened) {
      this.mineLayerGateJustOpened = false
      return
    }
    this.mineLayerSpawnRemainingMs = Math.max(0, this.mineLayerSpawnRemainingMs - dtMs)
    if (this.mineLayerSpawnRemainingMs > 0
      || this.enemies.filter((enemy) => enemy.type === 'mineLayer').length >= cfg.maxActive
      || viewport.width <= 0 || viewport.height <= 0) return
    this.mineLayerSpawnRemainingMs = cfg.spawnEveryMs
    if (this.rng() >= cfg.spawnChance) return
    const enemy = this.mineLayerPool.pop() ?? new MineLayer(cfg)
    if (!this.mineLayerViews.has(enemy)) this.mineLayerViews.set(enemy, new MineLayerView(cfg, this.enemyAssets.mineLayer))
    enemy.spawn(viewport, this.rng() < this.config.spawn.mineLayerLeftChance, this.enemyStageMultiplier, this.rng())
    const visual = this.mineLayerViews.get(enemy)!
    visual.sync(enemy)
    this.container.addChild(visual.view)
    this.enemies.push(enemy)
  }

  private dropMine(position: Position) {
    const cfg = this.enemyConfig!.mineLayer!.mine
    if (this.mines.length >= cfg.maxActive) return
    const mine = this.minePool.pop() ?? new Mine(cfg)
    if (!this.mineViews.has(mine)) this.mineViews.set(mine, new MineView(cfg, this.enemyAssets))
    mine.spawn(position)
    this.onSfx?.('mine_drop')
    const visual = this.mineViews.get(mine)!
    visual.sync(mine)
    this.container.addChild(visual.view)
    this.mines.push(mine)
  }

  private fireEnemyBullet(enemy: SentryTurret, direction: Position) {
    const cfg = enemy.config.bullet
    if (this.enemyBullets.length >= cfg.maxActive) return
    this.onSfx?.('turret_fire')
    const bullet = this.enemyBulletPool.pop() ?? new Bullet(this.enemyAssets.projectile)
    bullet.spawn({ x: enemy.position.x, y: enemy.position.y,
      directionX: direction.x, directionY: direction.y,
      speed: cfg.speed, radius: cfg.radius, damage: cfg.damage,
      lifetimeMs: cfg.lifetimeMs, color: cfg.color,
      pierceLeft: cfg.pierce, falloff: null })
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
      if (enemy.isDead()) {
        this.onSfx?.('enemy_destroy')
        this.onEnemyDestroyed?.(enemy)
      }
      if (enemy.type === 'sentryTurret') {
        this.protectedTurrets.delete(enemy)
        enemy.shieldDrone?.leave()
        this.container.removeChild(this.enemyViews.get(enemy)!.view)
        this.enemyPool.push(enemy)
      } else if (enemy.type === 'mineLayer') {
        this.container.removeChild(this.mineLayerViews.get(enemy)!.view)
        this.mineLayerPool.push(enemy)
      } else {
        enemy.detach()
        this.container.removeChild(this.droneViews.get(enemy)!.view)
        this.dronePool.push(enemy)
      }
      this.enemies.splice(i, 1)
    }
    for (let i = this.mines.length - 1; i >= 0; i -= 1) {
      const mine = this.mines[i]
      const visual = this.mineViews.get(mine)!
      if (!mine.visible) {
        this.container.removeChild(visual.view)
        this.mines.splice(i, 1)
        this.minePool.push(mine)
      } else visual.sync(mine)
    }
    // Also runs after collisions: shield visuals reflect lethal hits this frame.
    for (const enemy of this.enemies) {
      if (enemy.type === 'sentryTurret') {
        if (enemy.isShielded) {
          if (!this.protectedTurrets.has(enemy)) this.onSfx?.('shield_enable')
          this.protectedTurrets.add(enemy)
        } else this.protectedTurrets.delete(enemy)
        this.enemyViews.get(enemy)!.sync(enemy)
      } else if (enemy.type === 'mineLayer') this.mineLayerViews.get(enemy)!.sync(enemy)
      else this.droneViews.get(enemy)!.sync(enemy)
    }
  }

  clearEnemies() {
    this.protectedTurrets.clear()
    for (const enemy of this.enemies) {
      if (enemy.type === 'sentryTurret') enemy.shieldDrone?.leave()
      else if (enemy.type === 'shieldDrone') enemy.detach()
      enemy.state = 'inactive'
    }
    for (const mine of [...this.mines, ...this.minePool]) mine.state = 'inactive'
    for (const visual of this.mineViews.values()) visual.destroy()
    for (const visual of this.mineLayerViews.values()) visual.destroy()
    this.mineViews.clear()
    this.mineLayerViews.clear()
    this.mines = []
    this.minePool = []
    this.mineLayerPool = []
    this.mineLayerSpawnRemainingMs = this.enemyConfig.mineLayer.firstSpawnDelayMs
    this.mineLayerGateJustOpened = true
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
    const cfg = this.config.asteroids.types[type]

    const edge = this.rollSpawnEdge()
    const pad = cfg.radius + this.config.spawn.spawnPadding

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

    const speed = cfg.speed * (this.config.spawn.speedMultiplier.min + this.rng() * this.config.spawn.speedMultiplier.range)
    const vx = (dirX / len) * speed
    const vy = (dirY / len) * speed

    const asteroid = this.pool.pop() ?? new AsteroidEntity(this.config.asteroids, { visuals: this.asteroidVisuals })
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

  setTuning(next: SpawnTuning) {
    this.maxActive = Math.max(1, Math.floor(next.maxActive))
    this.spawnEveryMs = Math.max(this.config.spawn.minSpawnEveryMs, Math.floor(next.spawnEveryMs))
    this.typeWeights = normalizeWeights(next.typeWeights)
    this.stageMultiplier = next.stageMultiplier
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
    if (!(total > 0)) throw new Error('Invalid asteroid weights')

    const r = this.rng() * total
    if (r < weights.normal) return 'normal'
    if (r < weights.normal + weights.fast) return 'fast'
    if (r < weights.normal + weights.fast + weights.big) return 'big'
    return 'armored'
  }

  private rollSpawnEdge() {
    // 0=top, 1=right, 2=bottom, 3=left
    // Anti-camp: favor spawns coming "from above" (top) and reduce bottom spawns.
    const wTop = this.config.spawn.edgeWeights.top
    const wRight = this.config.spawn.edgeWeights.right
    const wBottom = this.config.spawn.edgeWeights.bottom
    const wLeft = this.config.spawn.edgeWeights.left
    const total = wTop + wRight + wBottom + wLeft
    const r = this.rng() * total
    if (r < wTop) return 0
    if (r < wTop + wRight) return 1
    if (r < wTop + wRight + wBottom) return 2
    return 3
  }

  private pickTarget(viewport: { width: number; height: number }) {
    const player = this.getPlayerPosition()
    const stageT = Math.max(0, Math.min(1, (this.stageMultiplier - 1) / this.config.spawn.targeting.stageSpan))
    const targetPlayerChance = Math.min(this.config.spawn.targeting.maxChance, this.config.spawn.targeting.baseChance + stageT * this.config.spawn.targeting.stageChance)

    if (player && this.rng() < targetPlayerChance) {
      const x = Math.max(this.config.spawn.targeting.playerPadding, Math.min(viewport.width - this.config.spawn.targeting.playerPadding, player.x))
      const y = Math.max(this.config.spawn.targeting.playerPadding, Math.min(viewport.height - this.config.spawn.targeting.playerPadding, player.y))
      return { x, y }
    }

    return {
      x: viewport.width * (this.config.spawn.targeting.areaStart + this.rng() * this.config.spawn.targeting.areaRange),
      y: viewport.height * (this.config.spawn.targeting.areaStart + this.rng() * this.config.spawn.targeting.areaRange),
    }
  }

  private maybeSpawnDangerZone() {
    if (this.dangerZonesActive.length >= this.config.zones.danger.maxActive) return
    if (this.rng() > this.config.zones.danger.spawnChance) return

    const viewport = this.getViewportSize()
    if (viewport.width <= 0 || viewport.height <= 0) return

    const pad = this.config.zones.danger.spawnPadding
    const x = pad + this.rng() * Math.max(1, viewport.width - pad * 2)
    const y = pad + this.rng() * Math.max(1, viewport.height - pad * 2)

    const zone = this.dangerZonesPool.pop() ?? new DangerZoneEntity(this.config.zones.danger)
    zone.spawn({ x, y, ttlMs: this.config.zones.danger.ttlMs, radius: this.config.zones.danger.radius })
    this.dangerZonesActive.push(zone)
    this.zonesContainer.addChild(zone.view)
  }

  private maybeSpawnHealZone() {
    if (this.healZonesActive.length >= this.config.zones.heal.maxActive) return
    if (this.rng() > this.config.zones.heal.spawnChance) return

    const viewport = this.getViewportSize()
    if (viewport.width <= 0 || viewport.height <= 0) return

    const pad = this.config.zones.heal.spawnPadding
    const x = pad + this.rng() * Math.max(1, viewport.width - pad * 2)
    const y = pad + this.rng() * Math.max(1, viewport.height - pad * 2)

    const zone = this.healZonesPool.pop() ?? new HealZoneEntity(this.config.zones.heal)
    zone.spawn({ x, y, ttlMs: this.config.zones.heal.ttlMs, radius: this.config.zones.heal.radius })
    this.healZonesActive.push(zone)
    this.zonesContainer.addChild(zone.view)
  }
}

function normalizeWeights(weights: Record<AsteroidType, number>): Record<AsteroidType, number> {
  const next: Record<AsteroidType, number> = {
    normal: Math.max(0, weights.normal),
    fast: Math.max(0, weights.fast),
    big: Math.max(0, weights.big),
    armored: Math.max(0, weights.armored),
  }

  const total = next.normal + next.fast + next.big + next.armored
  if (!(total > 0) || !Number.isFinite(total)) throw new Error('Invalid asteroid weights')

  next.normal /= total
  next.fast /= total
  next.big /= total
  next.armored /= total
  return next
}
