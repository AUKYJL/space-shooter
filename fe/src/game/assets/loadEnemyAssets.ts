import { Assets, type Texture } from 'pixi.js'
import { ensureBundle } from './assets'
import { ENEMY_ASSET_URLS } from './enemyAssetUrls'

export type EnemyAssets = Record<keyof typeof ENEMY_ASSET_URLS, Texture>

export async function loadEnemyAssets(): Promise<EnemyAssets> {
  await ensureBundle('enemies')

  return {
    sentryPlatform: Assets.get<Texture>(ENEMY_ASSET_URLS.sentryPlatform),
    sentryCannon: Assets.get<Texture>(ENEMY_ASSET_URLS.sentryCannon),
    shieldDrone: Assets.get<Texture>(ENEMY_ASSET_URLS.shieldDrone),
    mineLayer: Assets.get<Texture>(ENEMY_ASSET_URLS.mineLayer),
    mineIdle: Assets.get<Texture>(ENEMY_ASSET_URLS.mineIdle),
    mineActive: Assets.get<Texture>(ENEMY_ASSET_URLS.mineActive),
    projectile: Assets.get<Texture>(ENEMY_ASSET_URLS.projectile),
  }
}
