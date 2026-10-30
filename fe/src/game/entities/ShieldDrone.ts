import type { Enemy, EnemyState, Position } from './Enemy'
import type { SentryTurret } from './SentryTurret'
import type { ShieldDroneConfig } from '@/game/core/enemyConfig'

export class ShieldDrone implements Enemy {
  readonly type = 'shieldDrone'
  readonly position: Position = { x: 0, y: 0 }
  readonly config: ShieldDroneConfig

  constructor(config: ShieldDroneConfig) { this.config = config }

  get radius() { return this.config.radius }
  state: EnemyState = 'inactive'
  hp = 0
  maxHp = 0
  turret: SentryTurret | null = null
  private stateMs = 0
  private startY = 0
  private viewport = { width: 0, height: 0 }

  get active() {
    return this.state === 'entering' || this.state === 'active' || this.state === 'leaving'
  }

  spawn(turret: SentryTurret, stageMultiplier: number, viewport: { width: number; height: number }) {
    this.detach()
    this.viewport = viewport
    turret.shieldDrone?.leave()
    this.turret = turret
    turret.shieldDrone = this
    this.position.x = this.followPosition(viewport).x
    this.position.y = this.startY = -this.radius
    this.hp = this.maxHp = Math.max(1, Math.ceil(this.config.hp * stageMultiplier))
    this.state = 'entering'
    this.stateMs = 0
  }

  private followPosition(viewport: { width: number; height: number }): Position {
    const target = this.turret!.position
    const x = target.x + this.config.offset + this.radius <= viewport.width
      ? target.x + this.config.offset : target.x - this.config.offset
    const marginX = Math.min(this.radius, viewport.width / 2)
    const marginY = Math.min(this.radius, viewport.height / 2)
    return { x: Math.max(marginX, Math.min(viewport.width - marginX, x)),
      y: Math.max(marginY, Math.min(viewport.height - marginY, target.y)) }
  }

  update(dtMs: number, viewport = this.viewport): null {
    if (!this.active) return null
    if (this.turret && (!this.turret.active || this.turret.state === 'leaving')) this.leave()
    let remaining = Math.max(0, dtMs)
    if (this.state === 'entering') {
      const step = Math.min(remaining, this.config.enteringMs - this.stateMs)
      this.stateMs += step
      remaining -= step
      const target = this.followPosition(viewport)
      const t = this.stateMs / this.config.enteringMs
      this.position.x = target.x
      this.position.y = this.startY + (target.y - this.startY) * (1 - (1 - t) ** 3)
      if (this.stateMs < this.config.enteringMs) return null
      this.state = 'active'
      this.stateMs = 0
    }
    if (this.state === 'active') {
      const target = this.followPosition(viewport)
      const dx = target.x - this.position.x
      const dy = target.y - this.position.y
      const distance = Math.hypot(dx, dy)
      const step = Math.min(distance, this.config.followSpeed * remaining / 1000)
      if (distance > 0) {
        this.position.x += dx / distance * step
        this.position.y += dy / distance * step
      }
    }
    if (this.state === 'leaving') {
      this.stateMs = Math.min(this.config.leavingMs, this.stateMs + remaining)
      const t = this.stateMs / this.config.leavingMs
      this.position.y = this.startY + (-this.radius - this.startY) * t * t
      if (this.stateMs >= this.config.leavingMs) this.state = 'inactive'
    }
    return null
  }

  isProtecting(turret: SentryTurret) {
    const dx = this.position.x - turret.position.x
    const dy = this.position.y - turret.position.y
    return this.turret === turret && this.active && this.state !== 'leaving'
      && turret.active && turret.state !== 'leaving'
      && dx * dx + dy * dy <= this.config.shieldRadius ** 2
  }

  detach() {
    if (this.turret?.shieldDrone === this) this.turret.shieldDrone = null
    this.turret = null
  }

  leave() {
    this.detach()
    if (!this.active || this.state === 'leaving') return
    this.state = 'leaving'
    this.stateMs = 0
    this.startY = this.position.y
  }

  takeDamage(amount: number) {
    if (!this.active) return
    this.hp = Math.max(0, this.hp - Math.max(0, amount))
    if (this.hp === 0) {
      this.state = 'destroyed'
      this.detach()
    }
  }

  isDead() { return this.state === 'destroyed' }
}
