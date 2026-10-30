import { Container, type Texture } from 'pixi.js'

import type { Scene } from '@/game/core/types'
import type { EventBus } from '@/game/core/EventBus'
import { PlayerShip, type PlayerShipVisuals } from '@/game/entities/PlayerShip'
import { InputSystem } from '@/game/systems/InputSystem'
import { ShootingSystem } from '@/game/systems/ShootingSystem'
import { SpawnSystem, type AsteroidVisualTuning } from '@/game/systems/SpawnSystem'
import { CollisionSystem } from '@/game/systems/CollisionSystem'
import { LootSystem } from '@/game/systems/LootSystem'
import { ChargeSystem } from '@/game/systems/ChargeSystem'
import { DifficultySystem } from '@/game/systems/DifficultySystem'
import { ExtractionSystem } from '@/game/systems/ExtractionSystem'
import { CameraSystem } from '@/game/systems/CameraSystem'
import type { AsteroidAssets } from '@/game/assets/loadAsteroidAssets'
import type { LootAssets } from '@/game/assets/loadLootAssets'
import type { RunBridgeEventMap, RunSummary } from '@/game/ui-bridge/gameToReact'
import type { ScoringConfig } from '@/modules/runs/api/runsApi'
import { calculateScore } from '@/game/scoring'
import type { Unsubscribe } from '@/game/core/EventBus'

export class RunScene implements Scene {
  private scoringConfig: ScoringConfig
  private container: Container = new Container()
  private bulletsContainer: Container = new Container()
  private asteroidsContainer: Container = new Container()
  private lootContainer: Container = new Container()
  private extractionContainer: Container = new Container()
  private player: PlayerShip
  private input: InputSystem
  private shooting: ShootingSystem
  private spawns: SpawnSystem
  private collisions: CollisionSystem
  private loot: LootSystem
  private charge: ChargeSystem
  private difficulty: DifficultySystem
  private extraction: ExtractionSystem
  private camera: CameraSystem
  private events: EventBus<RunBridgeEventMap>
  private hudEmitRemainingMs = 0
  private getViewportSize: () => { width: number; height: number }

  private hardPaused = false
  private finished = false
  private elapsedMs = 0
  private extractionCount = 0
  private multiplier = 1
  private enemiesDestroyed = { sentryTurret: 0, shieldDrone: 0 }
  private destroyed: RunSummary['destroyed'] = { normal: 0, fast: 0, big: 0, armored: 0 }
  private unsubPause: Unsubscribe | null = null
  private unsubResume: Unsubscribe | null = null

  constructor(options: {
    scoringConfig: ScoringConfig
    canvas: HTMLCanvasElement
    getViewportSize: () => { width: number; height: number }
    events: EventBus<RunBridgeEventMap>
    weaponId?: string
    shipVisuals?: PlayerShipVisuals
    asteroidVisuals?: AsteroidAssets
    lootAssets?: LootAssets
    extractionBaseTexture?: Texture
    tuning?: {
      maxHp: number
      fireCooldownMs?: number
      bulletDamage: number
      chargedDamage: number
      asteroidVisualTuning?: AsteroidVisualTuning
    }
  }) {
    this.getViewportSize = options.getViewportSize
    this.scoringConfig = structuredClone(options.scoringConfig)
    this.events = options.events
    this.player = new PlayerShip({ maxHp: options.tuning?.maxHp, visuals: options.shipVisuals })
    this.input = new InputSystem({
      canvas: options.canvas,
      player: this.player,
      getViewportSize: options.getViewportSize,
      events: this.events,
    })
    this.shooting = new ShootingSystem({
      player: this.player,
      input: this.input,
      getViewportSize: options.getViewportSize,
      bulletsContainer: this.bulletsContainer,
      cooldownMs: options.tuning?.fireCooldownMs,
      bulletDamage: options.tuning?.bulletDamage,
      chargedDamage: options.tuning?.chargedDamage,
      weaponId: options.weaponId,
    })
    this.spawns = new SpawnSystem({
      enemies: this.scoringConfig.version >= 4 ? this.scoringConfig.enemies : undefined,
      onEnemyDestroyed: (enemy) => { this.enemiesDestroyed[enemy.type] += 1 },
      container: this.asteroidsContainer,
      getViewportSize: options.getViewportSize,
      getPlayerPosition: () => ({ x: this.player.view.position.x, y: this.player.view.position.y }),
      onAsteroidDestroyed: (asteroid) => {
        this.destroyed[asteroid.type] += 1
        this.loot.onAsteroidDestroyed(asteroid)
        this.charge.onAsteroidDestroyed(asteroid.type)
      },
      asteroidVisuals: options.asteroidVisuals,
      asteroidVisualTuning: options.tuning?.asteroidVisualTuning,
    })
    this.camera = new CameraSystem()
    this.collisions = new CollisionSystem({
      player: this.player,
      shooting: this.shooting,
      spawns: this.spawns,
      onPlayerDamaged: () => this.camera.shake({ durationMs: 150, amplitudePx: 6 }),
    })
    this.loot = new LootSystem({ player: this.player, container: this.lootContainer, textures: options.lootAssets })
    this.charge = new ChargeSystem({ events: this.events, shooting: this.shooting })
    this.difficulty = new DifficultySystem()
    this.multiplier = this.difficulty.getStageMultiplier()
    this.extraction = new ExtractionSystem({
      container: this.extractionContainer,
      player: this.player,
      getViewportSize: options.getViewportSize,
      baseTexture: options.extractionBaseTexture,
    })
  }

  mount(root: Container) {
    root.addChild(this.container)
    this.container.addChild(this.extractionContainer)
    this.container.addChild(this.player.view)
    this.container.addChild(this.bulletsContainer)
    this.container.addChild(this.asteroidsContainer)
    this.container.addChild(this.lootContainer)
    this.input.mount()
    this.charge.mount()

    const size = this.getViewportSize()
    this.player.setPosition(size.width / 2, size.height * 0.7)

    this.unsubPause = this.events.on('run:pause', () => {
      if (this.finished) return
      this.hardPaused = true
    })

    this.unsubResume = this.events.on('run:resume', () => {
      if (this.finished) return
      this.hardPaused = false
    })
  }

  update(dtMs: number) {
    if (this.finished) return
    if (this.hardPaused) return

    this.camera.update(dtMs)
    const { x, y } = this.camera.getOffset()
    this.container.position.set(x, y)

    this.elapsedMs += dtMs

    this.difficulty.update(dtMs)
    this.spawns.setTuning(this.difficulty.getSpawnTuning())

    this.extraction.update(dtMs)
    if (this.extraction.consumeBaseExpired()) {
      this.difficulty.advanceStage()
      this.multiplier = this.difficulty.getStageMultiplier()
    }
    if (this.extraction.consumeExtracted()) {
      this.extractionCount += 1
      this.finishRun('extract')
      return
    }

    this.spawns.setEnemyStage(this.difficulty.getStage(), this.difficulty.getStageMultiplier())
    this.input.update(dtMs)
    this.shooting.update(dtMs)
    this.spawns.update(dtMs)
    this.collisions.update(dtMs)
    this.spawns.resolveDestroyedEnemies()
    this.loot.update(dtMs)

    if (this.player.hp <= 0) {
      this.finishRun('death')
      return
    }

    this.hudEmitRemainingMs = Math.max(0, this.hudEmitRemainingMs - dtMs)
    if (this.hudEmitRemainingMs <= 0) {
      this.hudEmitRemainingMs = 100
      const extraction = this.extraction.getExtractionState()
      this.events.emit('run:hud-update', {
        enemiesDestroyed: { ...this.enemiesDestroyed },
        score: calculateScore(this.scoringConfig, this.destroyed, this.difficulty.getStage(), this.enemiesDestroyed),
        stage: this.difficulty.getStage(),
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        charge: this.charge.charge,
        multiplier: this.multiplier,
        coins: this.loot.totals.coins,
        iron: this.loot.totals.iron,
        gold: this.loot.totals.gold,
        crystal: this.loot.totals.crystal,
        extractionAvailable: extraction.available,
        extractionBaseTtlMs: extraction.baseTtlRemainingMs,
        extractionProgressMs: extraction.progressMs,
        extractionRequiredMs: extraction.requiredMs,
        extractionInZone: extraction.inZone,
      })
    }
  }

  private finishRun(endedBy: 'death' | 'extract') {
    if (this.finished) return
    this.finished = true
    this.spawns.clearEnemies()

    const collected = { ...this.loot.totals }
    const banked =
      endedBy === 'extract'
        ? {
            coins: Math.round(collected.coins * this.multiplier),
            iron: Math.round(collected.iron * this.multiplier),
            gold: Math.round(collected.gold * this.multiplier),
            crystal: Math.round(collected.crystal * this.multiplier),
          }
        : { coins: 0, iron: 0, gold: 0, crystal: 0 }

    this.events.emit('run:finished', {
      score: calculateScore(this.scoringConfig, this.destroyed, this.difficulty.getStage(), this.enemiesDestroyed),
      stageReached: this.difficulty.getStage(),
      durationMs: this.elapsedMs,
      endedBy,
      extractionCount: this.extractionCount,
      multiplier: this.multiplier,
      collected,
      banked,
      destroyed: { ...this.destroyed },
      enemiesDestroyed: { ...this.enemiesDestroyed },
    })
  }

  destroy() {
    this.unsubPause?.()
    this.unsubPause = null
    this.unsubResume?.()
    this.unsubResume = null

    this.input.destroy()
    this.shooting.destroy()
    this.spawns.destroy()
    this.loot.destroy()
    this.charge.destroy()
    this.extraction.destroy()
    this.player.destroy()
    this.container.removeChildren()
    this.container.destroy({ children: true })
  }
}
