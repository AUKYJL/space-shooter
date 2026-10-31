import type { LootConfig } from '@/game/core/gameplayConfig'
import { Container } from 'pixi.js'

import type { LootDrop, LootType } from '@/game/entities/LootDrop'
import { LootDrop as LootDropEntity } from '@/game/entities/LootDrop'
import type { PlayerShip } from '@/game/entities/PlayerShip'
import type { AsteroidType } from '@/game/entities/Asteroid'
import type { LootAssets } from '@/game/assets/loadLootAssets'

export type LootTotals = {
  coins: number
  iron: number
  gold: number
  crystal: number
}

export class LootSystem {
  private player: PlayerShip
  private container: Container
  private textures: Partial<Record<LootType, LootAssets[keyof LootAssets]>> | null

  private active: LootDrop[] = []
  private pool: LootDrop[] = []

  private lootLifetimeMs: number

  totals: LootTotals = { coins: 0, iron: 0, gold: 0, crystal: 0 }

  private config: LootConfig

  constructor(config: LootConfig, options: { player: PlayerShip; container: Container; textures?: LootAssets }) {
    this.config = config
    this.lootLifetimeMs = config.lifetimeMs
    this.player = options.player
    this.container = options.container
    this.textures = options.textures ?? null
  }

  update(dtMs: number) {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const drop = this.active[i]
      if (!drop.active) continue
      drop.update(dtMs)

      if (drop.isExpired(this.lootLifetimeMs)) {
        this.despawnAt(i)
        continue
      }

      if (this.playerOverlaps(drop)) {
        this.collect(drop)
        this.despawnAt(i)
      }
    }
  }

  onAsteroidDestroyed(asteroid: { type: AsteroidType; view: { position: { x: number; y: number } } }) {
    const x = asteroid.view.position.x
    const y = asteroid.view.position.y

    const drops = rollDrops(asteroid.type, this.config)
    for (const drop of drops) {
      this.spawnOne({ type: drop.type, amount: drop.amount, x, y })
    }
  }

  private spawnOne(options: { type: LootType; amount: number; x: number; y: number }) {
    const drop = this.pool.pop() ?? new LootDropEntity(this.config.radius)
    const scatter = this.config.scatter
    drop.spawn({
      ...options,
      texture: this.textures ? this.textures[options.type] : undefined,
      x: options.x + (Math.random() * 2 - 1) * scatter,
      y: options.y + (Math.random() * 2 - 1) * scatter,
    })
    this.active.push(drop)
    this.container.addChild(drop.view)
  }

  private playerOverlaps(drop: LootDrop) {
    const px = this.player.view.position.x
    const py = this.player.view.position.y
    const dx = px - drop.view.position.x
    const dy = py - drop.view.position.y
    const r = this.player.pickupRadius + drop.radius
    return dx * dx + dy * dy <= r * r
  }

  private collect(drop: LootDrop) {
    if (drop.type === 'coins') this.totals.coins += drop.amount
    else if (drop.type === 'iron') this.totals.iron += drop.amount
    else if (drop.type === 'gold') this.totals.gold += drop.amount
    else this.totals.crystal += drop.amount
  }

  private despawnAt(index: number) {
    const drop = this.active[index]
    drop.despawn()
    this.container.removeChild(drop.view)
    this.active.splice(index, 1)
    this.pool.push(drop)
  }

  destroy() {
    for (const drop of this.active) drop.destroy()
    for (const drop of this.pool) drop.destroy()
    this.active = []
    this.pool = []
  }
}

export function rollDrops(type: AsteroidType, config: LootConfig): Array<{ type: LootType; amount: number }> {
  // Simple MVP table: always coins, occasional crystal/iron/gold.
  const drops: Array<{ type: LootType; amount: number }> = []

  const rule = config.drops[type]
  drops.push({ type: 'coins', amount: rule.coins + Math.floor(Math.random() * config.coinBonusExclusive) })
  if (Math.random() < rule.ironChance) drops.push({ type: 'iron', amount: config.resourceAmount })
  if (Math.random() < rule.crystalChance) drops.push({ type: 'crystal', amount: config.resourceAmount })
  if (Math.random() < rule.goldChance) drops.push({ type: 'gold', amount: config.resourceAmount })

  return drops
}
