import { Assets, type Texture } from 'pixi.js'
import { ensureBundle } from './assets'

import { LOOT_ASSET_URLS } from '@/game/assets/lootAssetUrls'

export type LootAssets = {
  coins: Texture
  crystal: Texture
}

export async function loadLootAssets(): Promise<LootAssets> {
  await ensureBundle('loot')

  return {
    coins: Assets.get<Texture>(LOOT_ASSET_URLS.coins),
    crystal: Assets.get<Texture>(LOOT_ASSET_URLS.crystal),
  }
}

