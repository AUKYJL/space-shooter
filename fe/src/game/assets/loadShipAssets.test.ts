import { describe, expect, it, vi } from 'vitest'

vi.mock('pixi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pixi.js')>()
  return {
    ...actual,
    Assets: {
      load: vi.fn(async (urls: string[]) =>
        Object.fromEntries(urls.map((u) => [u, actual.Texture.WHITE])),
      ),
    },
  }
})

import { loadShipAssets } from '@/game/assets/loadShipAssets'

describe('loadShipAssets', () => {
  it('returns shipTexture + flameTextures', async () => {
    const assets = await loadShipAssets()
    expect(assets.shipTexture).toBeTruthy()
    expect(assets.flameTextures).toHaveLength(4)
  })
})

