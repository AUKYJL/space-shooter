import { ENEMY_ASSETS } from '@/test/enemyAssets'
import { DifficultySystem } from '@/game/systems/DifficultySystem'
import { GAMEPLAY_CONFIG, } from '@/test/runConfig'
import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { SpawnSystem } from './SpawnSystem'
import { ENEMY_CONFIG, MINE_LAYER_CONFIG as cfg } from '@/test/enemyConfig'

function setup(overrides: Partial<typeof cfg> = {}, rng = () => 0.25) {
  const container = new Container()
  const onEnemyDestroyed = vi.fn()
  const onSfx = vi.fn()
  const enemies = { ...ENEMY_CONFIG, sentryTurret: { ...ENEMY_CONFIG.sentryTurret, spawnChance: 0 },
    mineLayer: { ...cfg, ...overrides } }
  const system = new SpawnSystem(GAMEPLAY_CONFIG, { enemyAssets: ENEMY_ASSETS, getPlayerPosition: () => ({ x: 200, y: 700 }), container, getViewportSize: () => ({ width: 400, height: 800 }),
    rng, enemies, onEnemyDestroyed, onSfx })
  system.setTuning({ ...new DifficultySystem(GAMEPLAY_CONFIG.difficulty).getSpawnTuning(), spawnEveryMs: 1000000 })
  return { system, container, onEnemyDestroyed, enemies, onSfx }
}
function open(system: SpawnSystem) {
  system.setEnemyStage(4, 1.45)
  system.update(16)
  system.update(2000)
  return system.getEnemies().find((enemy) => enemy.type === 'mineLayer')!
}

describe('SpawnSystem MineLayer', () => {
  it('signals only actual mine drops and dormant-to-armed transitions', () => {
    const { system, onSfx } = setup()
    open(system)
    system.update(1000)
    system.update(500)
    expect(system.getMines()).toHaveLength(1)
    expect(onSfx.mock.calls.filter(([id]) => id === 'mine_drop')).toHaveLength(1)
    system.update(cfg.mine.activationMs)
    system.update(0)
    expect(onSfx.mock.calls.filter(([id]) => id === 'mine_armed')).toHaveLength(1)
    system.destroy()
  })

  it('uses the injected RNG to choose a fresh height on each ship spawn', () => {
    let roll = 0.1
    const { system } = setup({}, () => roll)
    const ship = open(system)
    expect(ship.position.y).toBeCloseTo(176)
    ship.takeDamage(100)
    system.resolveDestroyedEnemies()
    roll = 0.9
    system.update(18000)
    expect(system.getEnemies()[0]).toBe(ship)
    expect(ship.position.y).toBeCloseTo(304)
    system.destroy()
  })

  it('gates Stage 4 and first delay independently of a disabled turret, pins config and caps ships', () => {
    const { system, enemies } = setup()
    system.setEnemyStage(3, 1.3)
    system.update(90000)
    expect(system.getEnemies()).toHaveLength(0)
    system.setEnemyStage(4, 1.45)
    system.update(90000)
    system.update(1999)
    expect(system.getEnemies()).toHaveLength(0)
    enemies.mineLayer.hp = 999
    system.update(1)
    const enemy = system.getEnemies()[0]
    expect(enemy.type).toBe('mineLayer')
    expect(enemy.state).toBe('entering')
    expect(enemy.hp).toBe(12)
    expect(enemy.position.x).toBe(-20)
    system.update(18000)
    expect(system.getEnemies()).toHaveLength(1)
    expect(system.getMines()).toHaveLength(0)
    system.destroy()
  })

  it('keeps mines after ship destruction, scores once, and reuses reset ship/mine pools', () => {
    const { system, onEnemyDestroyed } = setup()
    const ship = open(system)
    system.update(1000)
    system.update(500)
    const mine = system.getMines()[0]
    expect(mine.state).toBe('dormant')
    ship.takeDamage(100)
    system.resolveDestroyedEnemies()
    system.resolveDestroyedEnemies()
    expect(onEnemyDestroyed).toHaveBeenCalledExactlyOnceWith(ship)
    expect(system.getMines()).toEqual([mine])
    mine.takeDamage(1)
    system.resolveDestroyedEnemies()
    expect(system.getMines()).toHaveLength(0)
    system.update(16500)
    const next = system.getEnemies()[0]
    expect(next).toBe(ship)
    expect(next.state).toBe('entering')
    system.update(1000)
    system.update(500)
    expect(system.getMines()[0]).toBe(mine)
    expect(mine.state).toBe('dormant')
    expect(mine.hp).toBe(1)
    expect(onEnemyDestroyed).toHaveBeenCalledTimes(1)
    system.destroy()
  })

  it('consumes capped drops without retry and gives no score for departure', () => {
    const { system, onEnemyDestroyed } = setup({ mine: { ...cfg.mine, maxActive: 1 } })
    open(system)
    system.update(1000)
    system.update(500)
    const first = system.getMines()[0]
    system.update(1000) // Second drop is consumed at the cap.
    first.takeDamage(1)
    system.resolveDestroyedEnemies()
    system.update(1)
    expect(system.getMines()).toHaveLength(0)
    system.update(999)
    expect(system.getMines()).toHaveLength(1)
    system.update(1500)
    system.update(1000)
    expect(system.getEnemies()).toHaveLength(0)
    expect(system.getMines()).toHaveLength(1)
    expect(onEnemyDestroyed).not.toHaveBeenCalled()
    system.destroy()
  })

  it.each([0, 1])('clears active/exploding objects and pooled views idempotently (explode=%s)', (explode) => {
    const { system, container, onEnemyDestroyed } = setup()
    const ship = open(system)
    system.update(1000)
    system.update(500)
    const mine = system.getMines()[0]
    if (explode) { mine.update(cfg.mine.activationMs); mine.detonate() }
    const views = container.children.filter((view) => view !== container.children[0])
    system.clearEnemies()
    expect(ship.active).toBe(false)
    expect(mine.visible).toBe(false)
    expect(system.getEnemies()).toHaveLength(0)
    expect(system.getMines()).toHaveLength(0)
    // Only the unrelated asteroid may remain alongside the zones container.
    expect(views.filter((view) => view.destroyed)).toHaveLength(2)
    system.clearEnemies()
    system.destroy()
    expect(onEnemyDestroyed).not.toHaveBeenCalled()
  })

  it('does not spawn when disabled by chance or cap', () => {
    for (const overrides of [{ spawnChance: 0 }, { maxActive: 0 }]) {
      const { system } = setup(overrides)
      open(system)
      system.update(100000)
      expect(system.getEnemies()).toHaveLength(0)
      system.destroy()
    }
  })
})
