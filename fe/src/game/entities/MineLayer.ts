import type { MineLayerConfig } from '@/game/core/enemyConfig'
import type { Enemy, EnemyState, Position } from './Enemy'

// Fixed route sampled from the viewport at spawn; no Pixi or wall-clock timers.
export class MineLayer implements Enemy {
  get contactDamage() { return this.config.contactDamage }
  readonly type = 'mineLayer'
  readonly position: Position = { x: 0, y: 0 }
  state: EnemyState = 'inactive'
  hp = 0
  maxHp = 0
  direction = 1
  private stateMs = 0
  private dropRemainingMs = 0
  private dropped = 0
  private width = 0

  readonly config: MineLayerConfig

  constructor(config: MineLayerConfig) { this.config = config }

  get radius() { return this.config.radius }
  get active() { return this.state === 'entering' || this.state === 'active' || this.state === 'leaving' }
  get canDamagePlayer() { return this.active && this.state !== 'entering' }

  spawn(viewport: { width: number; height: number }, fromLeft: boolean, stageMultiplier: number, heightRoll: number) {
    this.width = viewport.width
    this.direction = fromLeft ? 1 : -1
    this.position.x = fromLeft ? -this.radius : this.width + this.radius
    const cfg = this.config
    const heightRatio = cfg.minHeightRatio + (cfg.maxHeightRatio - cfg.minHeightRatio) * heightRoll
    this.position.y = viewport.height * heightRatio
    this.hp = this.maxHp = Math.max(1, Math.ceil(this.config.hp * stageMultiplier))
    this.state = 'entering'
    this.stateMs = 0
    this.dropped = 0
    this.dropRemainingMs = this.config.firstDropDelayMs
  }

  update(dtMs: number): Position | null {
    if (!this.active) return null
    const cfg = this.config
    const dt = Math.max(0, dtMs)
    const phase = this.state
    const duration = phase === 'entering' ? cfg.enteringMs : phase === 'active' ? cfg.activeMs : cfg.leavingMs
    const step = Math.min(dt, Math.max(0, duration - this.stateMs))
    this.stateMs += step
    const t = duration > 0 ? this.stateMs / duration : 1
    const entry = this.width * cfg.entryRatio
    const exit = this.width * cfg.exitRatio
    const x = phase === 'entering' ? -this.radius + (entry + this.radius) * t
      : phase === 'active' ? entry + (exit - entry) * t
      : exit + (this.width + this.radius - exit) * t
    this.position.x = this.direction === 1 ? x : this.width - x
    let drop: Position | null = null
    if (phase === 'active') {
      this.dropRemainingMs -= step
      if (this.dropped < cfg.mineCount && this.dropRemainingMs <= 0) {
        this.dropped += 1
        this.dropRemainingMs = cfg.dropEveryMs
        drop = { ...this.position }
      }
    }
    // Discard phase overflow: long frames cannot spawn a catch-up burst.
    if (this.stateMs >= duration) {
      this.state = phase === 'entering' ? 'active' : phase === 'active' ? 'leaving' : 'inactive'
      this.stateMs = 0
    }
    return drop
  }

  takeDamage(amount: number) {
    if (!this.active) return
    this.hp = Math.max(0, this.hp - Math.max(0, amount))
    if (this.hp === 0) this.state = 'destroyed'
  }

  isDead() { return this.state === 'destroyed' }
}
