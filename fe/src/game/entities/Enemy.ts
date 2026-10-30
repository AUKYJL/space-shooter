export type Position = { x: number; y: number }

export interface DamageableTarget {
  readonly position: Position
  readonly radius: number
  readonly active: boolean
  readonly hp: number
  takeDamage(amount: number): void
  isDead(): boolean
}

export type EnemyType = 'sentryTurret' | 'shieldDrone'
export type EnemyState = 'entering' | 'active' | 'leaving' | 'inactive' | 'destroyed'

export interface Enemy extends DamageableTarget {
  readonly type: EnemyType
  readonly state: EnemyState
}
