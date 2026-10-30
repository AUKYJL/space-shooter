import { describe, expect, it, vi } from 'vitest'

vi.mock('pixi.js', () => {
  return {
    Assets: { load: vi.fn(async () => ({})) },
  }
})

import { Assets } from 'pixi.js'
import { loadAsteroidAssets } from '@/game/assets/loadAsteroidAssets'
import { ASTEROID_ASSET_URLS } from '@/game/assets/asteroidAssetUrls'

describe('loadAsteroidAssets', () => {
  it('loads all asteroid textures', async () => {
    await loadAsteroidAssets()
    expect(Assets.load).toHaveBeenCalledWith([
      ASTEROID_ASSET_URLS.normal,
      ASTEROID_ASSET_URLS.big,
      ASTEROID_ASSET_URLS.fast,
      ASTEROID_ASSET_URLS.armored,
    ])
  })
})

