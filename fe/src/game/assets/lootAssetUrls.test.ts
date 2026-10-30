import { describe, expect, it } from 'vitest'

import { LOOT_ASSET_URLS } from '@/game/assets/lootAssetUrls'

describe('lootAssetUrls', () => {
  it('contains sprite urls for coins/crystal', () => {
    expect(LOOT_ASSET_URLS.coins).toMatch(/\.png$/)
    expect(LOOT_ASSET_URLS.crystal).toMatch(/\.png$/)
  })
})

