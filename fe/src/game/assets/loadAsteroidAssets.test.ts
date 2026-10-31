import { describe, expect, it, vi } from 'vitest'
vi.mock('./assets', () => ({ ensureBundle: vi.fn(async () => {}) }))
vi.mock('pixi.js', () => ({ Assets: { get: vi.fn((url: string) => url) } }))
import { ensureBundle } from './assets'
import { loadAsteroidAssets } from './loadAsteroidAssets'
import { ASTEROID_ASSET_URLS } from './asteroidAssetUrls'

describe('loadAsteroidAssets', () => {
  it('maps the shared bundle cache to existing texture keys', async () => {
    const assets = await loadAsteroidAssets()
    expect(ensureBundle).toHaveBeenCalledWith('asteroids')
    expect(assets).toEqual(ASTEROID_ASSET_URLS)
  })
})
