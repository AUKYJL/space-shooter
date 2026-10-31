import { Graphics, Sprite, Texture, TextureSource } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ENEMY_ASSETS } from '@/test/enemyAssets'
import { SENTRY_TURRET_CONFIG as sentryCfg, SHIELD_DRONE_CONFIG as droneCfg, MINE_LAYER_CONFIG as layerCfg } from '@/test/enemyConfig'
import { SentryTurret } from '@/game/entities/SentryTurret'
import { ShieldDrone } from '@/game/entities/ShieldDrone'
import { MineLayer } from '@/game/entities/MineLayer'
import { Mine } from '@/game/entities/Mine'
import { Bullet } from '@/game/entities/Bullet'
import { SentryTurretView } from './SentryTurretView'
import { ShieldDroneView } from './ShieldDroneView'
import { MineLayerView } from './MineLayerView'
import { MineView } from './MineView'

const viewport = { width: 400, height: 800 }

afterEach(() => vi.unstubAllEnvs())

it('aims only the sentry cannon, retaining platform size, original sprite colors, HP and shield', () => {
  const model = new SentryTurret(sentryCfg)
  model.spawn(150, 120, 1)
  const visual = new SentryTurretView(sentryCfg, droneCfg, ENEMY_ASSETS)
  const [shield, platform, cannon, hp] = visual.view.children
  expect(platform).toBeInstanceOf(Sprite)
  expect(cannon).toBeInstanceOf(Sprite)
  expect(shield).toBeInstanceOf(Graphics)
  expect(hp).toBeInstanceOf(Graphics)
  expect((platform as Sprite).anchor.x).toBe(0.5)
  expect((cannon as Sprite).anchor.y).toBe(0.5)
  expect(platform.width).toBe(sentryCfg.width)
  expect(platform.height).toBe(sentryCfg.height)
  expect(cannon.width).toBe(sentryCfg.width)
  expect(cannon.height).toBe(sentryCfg.height)
  visual.sync(model)
  expect((platform as Sprite).tint).toBe(0xffffff)
  expect((cannon as Sprite).tint).toBe(0xffffff)
  model.update(sentryCfg.enteringMs, { x: 150, y: 700 })
  for (const [x, y] of [[350, 120], [150, 700], [0, 120], [150, 0]]) {
    model.update(0, { x, y })
    visual.sync(model)
    // The original cannon points down in texture space.
    expect(-Math.sin(cannon.rotation)).toBeCloseTo(Math.cos(model.angle))
    expect(Math.cos(cannon.rotation)).toBeCloseTo(Math.sin(model.angle))
    expect(platform.rotation).toBe(0)
    expect(visual.view.x).toBe(model.position.x)
    expect(visual.view.y).toBe(model.position.y)
  }
  expect((platform as Sprite).tint).toBe(0xffffff)
  expect((cannon as Sprite).tint).toBe(0xffffff)
  const drone = new ShieldDrone(droneCfg)
  drone.spawn(model, 1, viewport)
  drone.update(droneCfg.enteringMs, viewport)
  visual.sync(model)
  expect(shield.visible).toBe(true)
  drone.takeDamage(drone.hp)
  model.takeDamage(1)
  visual.sync(model)
  expect(model.hp).toBe(sentryCfg.hp - 1)
  expect(shield.visible).toBe(false)
  expect(hp.visible).toBe(true)
  model.state = 'leaving'
  visual.sync(model)
  expect((platform as Sprite).tint).toBe(0xffffff)
  expect((cannon as Sprite).tint).toBe(0xffffff)
  visual.destroy()
  expect(ENEMY_ASSETS.sentryPlatform.destroyed).toBe(false)
  expect(ENEMY_ASSETS.sentryCannon.destroyed).toBe(false)
})

it('centers the drone and keeps the mine layer footprint and facing in both directions', () => {
  const turret = new SentryTurret(sentryCfg)
  turret.spawn(150, 120, 1)
  const drone = new ShieldDrone(droneCfg)
  drone.spawn(turret, 1, viewport)
  const droneVisual = new ShieldDroneView(droneCfg, ENEMY_ASSETS.shieldDrone)
  droneVisual.sync(drone)
  const body = droneVisual.view.children[0] as Sprite
  expect(body.texture).toBe(ENEMY_ASSETS.shieldDrone)
  expect(body.width).toBe(droneCfg.radius * 2)
  expect(body.height).toBe(droneCfg.radius * 2)
  expect(body.anchor.x).toBe(0.5)
  expect(body.anchor.y).toBe(0.5)
  expect(droneVisual.view.x).toBe(drone.position.x)
  const layer = new MineLayer(layerCfg)
  const visual = new MineLayerView(layerCfg, ENEMY_ASSETS.mineLayer)
  for (const fromLeft of [true, false]) {
    layer.spawn(viewport, fromLeft, 1, 0.5)
    visual.sync(layer)
    const sprite = visual.view.children[0] as Sprite
    expect(sprite.width).toBeCloseTo(layerCfg.height)
    expect(sprite.height).toBeCloseTo(layerCfg.width)
    const rotation = visual.view.rotation + sprite.rotation
    // The source image points up.
    expect(Math.sin(rotation)).toBeCloseTo(layer.direction)
    expect(Math.cos(rotation)).toBeCloseTo(0)
    expect(visual.view.x).toBe(layer.position.x)
  }
  visual.destroy()
  droneVisual.destroy()
  expect(ENEMY_ASSETS.mineLayer.destroyed).toBe(false)
  expect(ENEMY_ASSETS.shieldDrone.destroyed).toBe(false)
})

it('reuses one mine Sprite through blinking, explosions and respawn, even with differently sized textures', () => {
  const active = new Texture({ source: new TextureSource({ width: 180, height: 300 }) })
  const cfg = layerCfg.mine
  const model = new Mine(cfg)
  const visual = new MineView(cfg, { mineIdle: ENEMY_ASSETS.mineIdle, mineActive: active })
  const body = visual.view.children[0] as Sprite
  const explosion = visual.view.children[1]
  const outline = visual.view.children[2]
  model.spawn({ x: 50, y: 70 })
  visual.sync(model)
  expect(body.texture).toBe(ENEMY_ASSETS.mineIdle)
  expect(body.alpha).toBe(cfg.dormantAlpha)
  expect(outline.visible).toBe(true)
  const children = [...visual.view.children]
  model.update(cfg.activationMs)
  for (let i = 0; i < 4; i++) {
    visual.sync(model)
    expect(visual.view.children[0]).toBe(body)
    expect(visual.view.children).toEqual(children)
    expect(body.texture).toBe(model.blinkOn ? active : ENEMY_ASSETS.mineIdle)
    expect(body.alpha).toBe(model.blinkOn ? 1 : cfg.blinkAlpha)
    expect(body.width).toBeCloseTo(cfg.radius * 2)
    expect(body.height).toBeCloseTo(cfg.radius * 2)
    expect(visual.view.x).toBe(50)
    expect(visual.view.y).toBe(70)
    model.update(cfg.blinkEveryMs)
  }
  model.detonate()
  visual.sync(model)
  expect(body.visible).toBe(false)
  expect(explosion.visible).toBe(true)
  expect(outline.visible).toBe(false)
  model.update(cfg.explosionMs)
  visual.sync(model)
  expect(visual.view.visible).toBe(false)
  model.spawn({ x: 80, y: 90 })
  visual.sync(model)
  expect(visual.view.children[0]).toBe(body)
  expect(body.texture).toBe(ENEMY_ASSETS.mineIdle)
  expect(body.visible).toBe(true)
  expect(explosion.visible).toBe(false)
  expect(outline.visible).toBe(true)
  expect(visual.view.children[2]).toBe(outline)
  expect(body.width).toBeCloseTo(cfg.radius * 2)
  visual.destroy()
  expect(outline.destroyed).toBe(true)
  expect(active.destroyed).toBe(false)
  active.destroy(true)
})

describe('enemy projectile sprites', () => {
  it('resets direction and size on pooled spawn without changing motion or hitbox', () => {
    const bullet = new Bullet(ENEMY_ASSETS.projectile)
    const sprite = bullet.view.children[0] as Sprite
    expect(sprite).toBeInstanceOf(Sprite)
    expect(sprite.anchor.x).toBe(0.5)
    expect(sprite.anchor.y).toBe(0.5)
    for (const [directionX, directionY] of [[1, 0], [0, 1], [-1, 0], [0, -1], [3, 4]]) {
      bullet.spawn({ x: 100, y: 200, directionX, directionY, speed: 10, lifetimeMs: 1000,
        damage: 2, radius: 3, falloff: null, pierceLeft: 0 })
      const len = Math.hypot(directionX, directionY)
      expect(Math.sin(bullet.view.rotation)).toBeCloseTo(directionX / len)
      expect(-Math.cos(bullet.view.rotation)).toBeCloseTo(directionY / len)
      expect(bullet.radius).toBe(3)
      expect(sprite.width).toBeCloseTo(6)
      expect(sprite.height).toBeCloseTo(6)
      bullet.update(100)
      expect(bullet.view.x).toBeCloseTo(100 + directionX / len)
      expect(bullet.view.y).toBeCloseTo(200 + directionY / len)
      bullet.despawn()
      expect(bullet.view.children[0]).toBe(sprite)
    }
    bullet.destroy()
    expect(ENEMY_ASSETS.projectile.destroyed).toBe(false)
  })

  it('retains Graphics for player bullets', () => {
    const bullet = new Bullet()
    expect(bullet.view.children[0]).toBeInstanceOf(Graphics)
    bullet.destroy()
  })
})


describe('enemy debug hitboxes', () => {
  it.each([
    { dev: true, env: undefined, enabled: true },
    { dev: false, env: 'debug', enabled: true },
    { dev: false, env: 'production', enabled: false },
    { dev: false, env: undefined, enabled: false },
  ])('draws collision outlines only in debug (DEV=$dev, ENV=$env)', ({ dev, env, enabled }) => {
    vi.stubEnv('DEV', dev)
    vi.stubEnv('ENV', env)
    const radius = 37
    const views = [
      { visual: new SentryTurretView({ ...sentryCfg, radius, width: 80, height: 60 }, droneCfg, ENEMY_ASSETS), baseChildren: 4 },
      { visual: new ShieldDroneView({ ...droneCfg, radius }, ENEMY_ASSETS.shieldDrone), baseChildren: 1 },
      { visual: new MineLayerView({ ...layerCfg, radius, width: 120, height: 50 }, ENEMY_ASSETS.mineLayer), baseChildren: 1 },
      { visual: new MineView({ ...layerCfg.mine, radius }, ENEMY_ASSETS), baseChildren: 2 },
    ]
    for (const { visual, baseChildren } of views) {
      expect(visual.view.children).toHaveLength(baseChildren + Number(enabled))
      const outline = visual.view.children[baseChildren] as Graphics | undefined
      if (enabled) {
        expect(outline).toBeInstanceOf(Graphics)
        const bounds = outline!.getLocalBounds()
        expect(bounds.x).toBeCloseTo(-radius - 0.5)
        expect(bounds.y).toBeCloseTo(-radius - 0.5)
        expect(bounds.width).toBeCloseTo(radius * 2 + 1)
        expect(bounds.height).toBeCloseTo(radius * 2 + 1)
        expect(outline!.x).toBe(0)
        expect(outline!.y).toBe(0)
        expect(outline!.context.strokeStyle).toMatchObject({ color: 0xff5555, width: 1, alpha: 0.55 })
      }
      visual.destroy()
      if (outline) expect(outline.destroyed).toBe(true)
    }
  })
})
