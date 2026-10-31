import type { ExtractionConfig } from '@/game/core/gameplayConfig'
import { Container, type Texture } from 'pixi.js'

import { ExtractionBase } from '@/game/entities/ExtractionBase'
import type { PlayerShip } from '@/game/entities/PlayerShip'

export type ExtractionState = {
  available: boolean
  inZone: boolean
  baseTtlRemainingMs: number
  progressMs: number
  requiredMs: number
}

export class ExtractionSystem {
  private container: Container
  private player: PlayerShip
  private getViewportSize: () => { width: number; height: number }

  private base: ExtractionBase
  private spawnEveryMs: number
  private ttlMs: number
  private spawnInMs: number
  private ttlRemainingMs = 0
  private progressMs = 0
  private requiredMs: number
  private extracted = false
  private baseExpired = false

  private config: ExtractionConfig

  constructor(config: ExtractionConfig, options: {
    container: Container
    player: PlayerShip
    getViewportSize: () => { width: number; height: number }
    baseTexture?: Texture
  }) {
    this.config = config
    this.spawnEveryMs = config.spawnEveryMs
    this.ttlMs = config.ttlMs
    this.spawnInMs = config.firstSpawnMs
    this.requiredMs = config.requiredMs
    this.container = options.container
    this.player = options.player
    this.getViewportSize = options.getViewportSize
    this.base = new ExtractionBase({ radius: config.radius, texture: options.baseTexture })
    this.container.addChild(this.base.view)
  }

  update(dtMs: number) {
    this.baseExpired = false
    if (this.base.active) {
      this.ttlRemainingMs = Math.max(0, this.ttlRemainingMs - dtMs)
      this.base.update(dtMs)
      if (this.ttlRemainingMs <= 0) {
        this.despawn()
        this.spawnInMs = this.spawnEveryMs
        this.baseExpired = true
      }
    } else {
      this.spawnInMs = Math.max(0, this.spawnInMs - dtMs)
      if (this.spawnInMs <= 0) {
        this.spawn()
      }
    }

    const inZone = this.playerOverlaps()
    if (this.base.active && inZone) {
      this.progressMs += dtMs
      if (this.progressMs >= this.requiredMs) {
        this.progressMs = this.requiredMs
        this.extracted = true
      }
      return
    }

    this.progressMs = Math.max(0, this.progressMs - dtMs)
  }

  getExtractionState(): ExtractionState {
    return {
      available: this.base.active,
      inZone: this.playerOverlaps(),
      baseTtlRemainingMs: this.base.active ? this.ttlRemainingMs : 0,
      progressMs: this.progressMs,
      requiredMs: this.requiredMs,
    }
  }

  playerOverlaps(): boolean {
    if (!this.base.active) return false

    const px = this.player.view.position.x
    const py = this.player.view.position.y
    const bx = this.base.view.position.x
    const by = this.base.view.position.y
    const r = this.player.pickupRadius + this.base.radius
    const dx = px - bx
    const dy = py - by
    return dx * dx + dy * dy <= r * r
  }

  consumeExtracted(): boolean {
    const v = this.extracted
    this.extracted = false
    return v
  }

  consumeBaseExpired(): boolean {
    const v = this.baseExpired
    this.baseExpired = false
    return v
  }

  private spawn() {
    const viewport = this.getViewportSize()
    if (viewport.width <= 0 || viewport.height <= 0) return

    const pad = this.config.spawnPadding
    const x = pad + Math.random() * Math.max(1, viewport.width - pad * 2)
    const y = pad + Math.random() * Math.max(1, viewport.height - pad * 2)

    this.base.spawn({ x, y })
    this.ttlRemainingMs = this.ttlMs
    this.progressMs = 0
  }

  private despawn() {
    if (!this.base.active) return
    this.base.despawn()
    this.progressMs = 0
  }

  forceSpawnForTest(options: { x: number; y: number; ttlMs: number }) {
    this.base.spawn({ x: options.x, y: options.y })
    this.ttlRemainingMs = Math.max(0, options.ttlMs)
    this.progressMs = 0
    this.extracted = false
    this.baseExpired = false
  }

  destroy() {
    this.base.destroy()
  }
}
