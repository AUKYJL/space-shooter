import type { AssetsManifest } from 'pixi.js'
import { SHIP_ASSET_URLS } from './shipAssetUrls'
import { ASTEROID_ASSET_URLS } from './asteroidAssetUrls'
import { LOOT_ASSET_URLS } from './lootAssetUrls'
import { EXTRACTION_ASSET_URLS } from './extractionAssetUrls'
import { ENEMY_ASSET_URLS } from './enemyAssetUrls'
import { AUDIO_CATALOG } from '@/game/audio/audioCatalog'

export const RUN_BUNDLES = ['ship', 'asteroids', 'loot', 'extraction', 'enemies'] as const
export const BUNDLE_URLS = {
  menu: [LOOT_ASSET_URLS.coins, LOOT_ASSET_URLS.crystal],
  ship: [SHIP_ASSET_URLS.ship, ...SHIP_ASSET_URLS.flameFrames],
  asteroids: Object.values(ASTEROID_ASSET_URLS),
  loot: Object.values(LOOT_ASSET_URLS),
  extraction: Object.values(EXTRACTION_ASSET_URLS),
  enemies: Object.values(ENEMY_ASSET_URLS),
  sfx: Object.values(AUDIO_CATALOG.sfx),
} satisfies Record<string, readonly string[]>

export type AssetBundle = keyof typeof BUNDLE_URLS
export const assetManifest: AssetsManifest = {
  bundles: Object.entries(BUNDLE_URLS).map(([name, urls]) => ({
    name,
    assets: [...new Set(urls)].map((url) => ({ alias: url, src: url })),
  })),
}
