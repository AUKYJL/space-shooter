import { describe, expect, it } from 'vitest'
import { SHIP_ASSET_URLS } from '@/game/assets/shipAssetUrls'

describe('SHIP_ASSET_URLS', () => {
  it('exposes ship + 4 flame frames', () => {
    expect(SHIP_ASSET_URLS.ship).toContain('ship.png')
    expect(SHIP_ASSET_URLS.flameFrames).toHaveLength(4)
    expect(SHIP_ASSET_URLS.flameFrames[0]).toContain('flame01.png')
  })
})

