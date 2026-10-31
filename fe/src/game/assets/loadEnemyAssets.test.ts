import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ENEMY_ASSETS } from '@/test/enemyAssets'
import { ensureBundle } from './assets'
import { ENEMY_ASSET_URLS } from './enemyAssetUrls'
import { loadEnemyAssets } from './loadEnemyAssets'

const pixi = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('pixi.js', async (original) => ({
  ...await original<typeof import('pixi.js')>(),
  Assets: { get: pixi.get },
}))

vi.mock('./assets', () => ({ ensureBundle: vi.fn(async () => {}) }))

beforeEach(() => {
  pixi.get.mockReset()
  vi.mocked(ensureBundle).mockReset().mockResolvedValue(undefined)
})

describe('enemy assets', () => {
  it('maps all seven renamed PNGs to shared cached textures', async () => {
    expect(Object.values(ENEMY_ASSET_URLS).map((url) => url.split('/').pop())).toEqual([
      'sentry-platform.png', 'sentry-cannon.png', 'shield-drone.png', 'mine-layer.png',
      'space-mine-idle.png', 'space-mine-active.png', 'enemy-projectile.png',
    ])
    const cached = new Map(Object.keys(ENEMY_ASSET_URLS).map((key) => [
      ENEMY_ASSET_URLS[key as keyof typeof ENEMY_ASSET_URLS], ENEMY_ASSETS[key as keyof typeof ENEMY_ASSETS],
    ]))
    const get = pixi.get.mockImplementation((url: string) => cached.get(url))
    const first = await loadEnemyAssets()
    const second = await loadEnemyAssets()
    expect(ensureBundle).toHaveBeenCalledWith('enemies')
    expect(first).toEqual(ENEMY_ASSETS)
    for (const key of Object.keys(first) as (keyof typeof first)[]) expect(second[key]).toBe(first[key])
    expect(get).toHaveBeenCalledTimes(14)
  })

  it('waits for readiness and propagates bundle errors without reading missing textures', async () => {
    const get = pixi.get
    let finish!: () => void
    vi.mocked(ensureBundle).mockReturnValueOnce(new Promise<void>((done) => { finish = done }))
    const pending = loadEnemyAssets()
    expect(get).not.toHaveBeenCalled()
    get.mockReturnValue(ENEMY_ASSETS.mineIdle)
    finish()
    await pending
    get.mockClear()
    vi.mocked(ensureBundle).mockRejectedValueOnce(new Error('enemy PNG unavailable'))
    await expect(loadEnemyAssets()).rejects.toThrow('enemy PNG unavailable')
    expect(get).not.toHaveBeenCalled()
  })
})
