import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ ensure: vi.fn(), get: vi.fn() }))
vi.mock('./assets', () => ({ ensureBundle: mocks.ensure }))
vi.mock('pixi.js', () => ({ Assets: { get: mocks.get } }))
import { loadZoneAssets } from './loadZoneAssets'
import { ZONE_ASSET_URLS } from './zoneAssetUrls'
beforeEach(() => { vi.resetAllMocks() })

describe('zone assets', () => {
  it('waits for the zones bundle and returns cached textures', async () => {
    let finish!: () => void
    mocks.ensure.mockReturnValue(new Promise<void>((resolve) => { finish = resolve }))
    const health = {}, skull = {}
    mocks.get.mockImplementation((url) => url === ZONE_ASSET_URLS.heal ? health : skull)
    const pending = loadZoneAssets()
    expect(mocks.ensure).toHaveBeenCalledWith('zones')
    expect(mocks.get).not.toHaveBeenCalled()
    finish()
    expect(await pending).toEqual({ heal: health, danger: skull })
  })
  it('propagates loading failures before reading the cache', async () => {
    mocks.ensure.mockRejectedValue(new Error('zone PNG unavailable'))
    await expect(loadZoneAssets()).rejects.toThrow('zone PNG unavailable')
    expect(mocks.get).not.toHaveBeenCalled()
  })
})
