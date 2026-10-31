import { Assets, type Texture } from 'pixi.js'
import { ensureBundle } from './assets'
import { ASTEROID_ASSET_URLS } from '@/game/assets/asteroidAssetUrls'

export type AsteroidAssets = {
  normal: Texture
  big: Texture
  fast: Texture
  armored: Texture
}

export async function loadAsteroidAssets(): Promise<AsteroidAssets> {
  await ensureBundle('asteroids')

  return {
    normal: Assets.get<Texture>(ASTEROID_ASSET_URLS.normal),
    big: Assets.get<Texture>(ASTEROID_ASSET_URLS.big),
    fast: Assets.get<Texture>(ASTEROID_ASSET_URLS.fast),
    armored: Assets.get<Texture>(ASTEROID_ASSET_URLS.armored),
  }
}

