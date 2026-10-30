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

  private lootLifetimeMs = 8000

  totals: LootTotals = { coins: 0, iron: 0, gold: 0, crystal: 0 }

  constructor(options: { player: PlayerShip; container: Container; textures?: LootAssets }) {
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

    const drops = rollDrops(asteroid.type)
    for (const drop of drops) {
      this.spawnOne({ type: drop.type, amount: drop.amount, x, y })
    }
  }

  private spawnOne(options: { type: LootType; amount: number; x: number; y: number }) {
    const drop = this.pool.pop() ?? new LootDropEntity()
    const scatter = 12
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

function rollDrops(type: AsteroidType): Array<{ type: LootType; amount: number }> {
  // Simple MVP table: always coins, occasional crystal/iron/gold.
  const drops: Array<{ type: LootType; amount: number }> = []

  const coinBase = type === 'big' ? 4 : type === 'armored' ? 5 : type === 'fast' ? 2 : 3
  drops.push({ type: 'coins', amount: coinBase + Math.floor(Math.random() * 3) })

  const ironChance = type === 'armored' ? 0.5 : type === 'big' ? 0.35 : 0.2
  if (Math.random() < ironChance) drops.push({ type: 'iron', amount: 1 })

  const crystalChance = type === 'armored' ? 0.25 : type === 'big' ? 0.15 : 0.08
  if (Math.random() < crystalChance) drops.push({ type: 'crystal', amount: 1 })

  const goldChance = type === 'armored' ? 0.18 : type === 'big' ? 0.12 : 0.06
  if (Math.random() < goldChance) drops.push({ type: 'gold', amount: 1 })

  return drops
}
