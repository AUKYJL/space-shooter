import { Assets, Texture } from 'pixi.js'
import { ASTEROID_ASSET_URLS } from '@/game/assets/asteroidAssetUrls'

export type AsteroidAssets = {
  normal: Texture
  big: Texture
  fast: Texture
  armored: Texture
}

export async function loadAsteroidAssets(): Promise<AsteroidAssets> {
  const urls = [
    ASTEROID_ASSET_URLS.normal,
    ASTEROID_ASSET_URLS.big,
    ASTEROID_ASSET_URLS.fast,
    ASTEROID_ASSET_URLS.armored,
  ]
  const loaded = (await Assets.load(urls)) as Record<string, Texture>

  return {
    normal: loaded[ASTEROID_ASSET_URLS.normal],
    big: loaded[ASTEROID_ASSET_URLS.big],
    fast: loaded[ASTEROID_ASSET_URLS.fast],
    armored: loaded[ASTEROID_ASSET_URLS.armored],
  }
}

