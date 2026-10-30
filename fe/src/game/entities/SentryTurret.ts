import type { Enemy, EnemyState, Position } from './Enemy'
import { SENTRY_TURRET_CONFIG } from './sentryTurretConfig'

// Gameplay model: no Pixi objects, drawing or wall-clock timers.
export class SentryTurret implements Enemy {
  readonly type = 'sentryTurret'
  readonly position: Position = { x: 0, y: 0 }
  readonly radius = SENTRY_TURRET_CONFIG.radius
  state: EnemyState = 'inactive'
  hp = 0
  maxHp = 0
  angle = Math.PI / 2
  private stateMs = 0
  private fireMs = 0
  private stopY = 0

  get active() {
    return this.state === 'entering' || this.state === 'active' || this.state === 'leaving'
  }

  spawn(x: number, stopY: number, stageMultiplier: number) {
    this.position.x = x
    this.position.y = -this.radius
    this.stopY = stopY
    this.hp = this.maxHp = Math.max(1, Math.ceil(SENTRY_TURRET_CONFIG.hp * stageMultiplier))
    this.angle = Math.PI / 2
    this.state = 'entering'
    this.stateMs = 0
    this.fireMs = 0
  }

  // Returns a single firing direction. Even a long frame never creates a burst.
  update(dtMs: number, player: Position): Position | null {
    if (!this.active) return null
    let remaining = Math.max(0, dtMs)
    const cfg = SENTRY_TURRET_CONFIG
    if (this.state === 'entering') {
      const step = Math.min(remaining, cfg.enteringMs - this.stateMs)
      this.stateMs += step
      remaining -= step
      const t = this.stateMs / cfg.enteringMs
      this.position.y = -this.radius + (this.stopY + this.radius) * (1 - (1 - t) ** 3)
      if (this.stateMs < cfg.enteringMs) return null
      this.state = 'active'
      this.stateMs = 0
    }
    let shot: Position | null = null
    if (this.state === 'active') {
      this.angle = Math.atan2(player.y - this.position.y, player.x - this.position.x)
      const step = Math.min(remaining, cfg.activeMs - this.stateMs)
      this.stateMs += step
      this.fireMs += step
      remaining -= step
      if (this.stateMs >= cfg.activeMs) {
        this.state = 'leaving'
        this.stateMs = 0
      } else if (this.fireMs >= cfg.fireEveryMs) {
        this.fireMs = 0
        shot = { x: Math.cos(this.angle), y: Math.sin(this.angle) }
      }
    }
    if (this.state === 'leaving') {
      this.stateMs = Math.min(cfg.leavingMs, this.stateMs + remaining)
      const t = this.stateMs / cfg.leavingMs
      this.position.y = this.stopY - (this.stopY + this.radius) * t * t
      if (this.stateMs >= cfg.leavingMs) this.state = 'inactive'
    }
    return shot
  }

  takeDamage(amount: number) {
    if (!this.active) return
    this.hp = Math.max(0, this.hp - Math.max(0, amount))
    if (this.hp === 0) this.state = 'destroyed'
  }

  isDead() {
    return this.state === 'destroyed'
  }
}
