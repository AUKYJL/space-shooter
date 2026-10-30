import { Assets, Texture } from 'pixi.js'

import { LOOT_ASSET_URLS } from '@/game/assets/lootAssetUrls'

export type LootAssets = {
  coins: Texture
  crystal: Texture
}

export async function loadLootAssets(): Promise<LootAssets> {
  const urls = [LOOT_ASSET_URLS.coins, LOOT_ASSET_URLS.crystal]
  const loaded = (await Assets.load(urls)) as Record<string, Texture>

  return {
    coins: loaded[LOOT_ASSET_URLS.coins],
    crystal: loaded[LOOT_ASSET_URLS.crystal],
  }
}

