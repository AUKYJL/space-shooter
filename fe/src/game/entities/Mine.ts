import type { MineConfig } from '@/game/core/enemyConfig'
import type { DamageableTarget, Position } from './Enemy'

export class Mine implements DamageableTarget {
  get contactDamage() { return this.config.damage }
  readonly position: Position = { x: 0, y: 0 }
  state: 'dormant' | 'armed' | 'exploding' | 'inactive' | 'destroyed' = 'inactive'
  hp = 0
  private stateMs = 0

  readonly config: MineConfig

  constructor(config: MineConfig) { this.config = config }

  get radius() { return this.config.radius }
  // active means damageable, including dormant mines, but excludes explosion effects.
  get active() { return this.state === 'dormant' || this.state === 'armed' }
  get visible() { return this.active || this.state === 'exploding' }
  get fuseExpired() { return this.state === 'armed' && this.stateMs >= this.config.fuseMs }
  get blinkOn() { return Math.floor(this.stateMs / this.config.blinkEveryMs) % 2 === 0 }

  spawn(position: Position) {
    this.position.x = position.x
    this.position.y = position.y
    this.hp = this.config.hp
    this.state = 'dormant'
    this.stateMs = 0
  }

  update(dtMs: number) {
    if (!this.visible) return
    this.stateMs += Math.max(0, dtMs)
    if (this.state === 'dormant' && this.stateMs >= this.config.activationMs) {
      this.state = 'armed'
      // Never skip the warning phase, even after a long frame.
      this.stateMs = 0
    } else if (this.state === 'exploding' && this.stateMs >= this.config.explosionMs) {
      this.state = 'inactive'
    }
  }

  detonate() {
    if (this.state !== 'armed') return false
    this.state = 'exploding'
    this.stateMs = 0
    return true
  }

  takeDamage(amount: number) {
    if (!this.active) return
    this.hp = Math.max(0, this.hp - Math.max(0, amount))
    if (this.hp === 0) this.state = 'destroyed'
  }

  isDead() { return this.state === 'destroyed' }
}
