import { beforeEach, describe, expect, it, vi } from 'vitest'

const pixi = vi.hoisted(() => ({ init: vi.fn(), loadBundle: vi.fn(), get: vi.fn(), load: vi.fn() }))
vi.mock('pixi.js', () => ({ Assets: pixi }))
vi.mock('@pixi/sound', () => ({ utils: { supported: { ogg: true } } }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  pixi.init.mockResolvedValue(undefined)
  pixi.loadBundle.mockResolvedValue({})
  pixi.load.mockResolvedValue({})
})

describe('shared assets', () => {
  it('initializes once, shares pending loads, and retains ready bundles', async () => {
    const { ensureBundle, ensureRunAssets } = await import('./assets')
    let finish!: () => void
    pixi.loadBundle.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
    const first = ensureBundle('ship')
    expect(ensureBundle('ship')).toBe(first)
    await vi.waitFor(() => expect(pixi.loadBundle).toHaveBeenCalledTimes(1))
    finish()
    await first
    await ensureRunAssets()
    await ensureRunAssets()
    expect(pixi.init).toHaveBeenCalledTimes(1)
    expect(pixi.loadBundle.mock.calls.map(([name]) => name)).toEqual(['ship', 'asteroids', 'loot', 'extraction', 'enemies'])
  })

  it('shares enemy preloads, retries a failed enemy bundle, and keeps it ready across runs', async () => {
    const { ensureBundle, ensureRunAssets, useAssetsStore } = await import('./assets')
    let fail = true
    pixi.loadBundle.mockImplementation(async (name) => {
      if (name === 'enemies' && fail) throw new Error('enemy PNG offline')
    })
    const first = ensureBundle('enemies')
    expect(ensureBundle('enemies')).toBe(first)
    await expect(first).rejects.toThrow('enemy PNG offline')
    expect(useAssetsStore.getState().bundles.enemies.status).toBe('error')
    fail = false
    await ensureRunAssets()
    await ensureRunAssets()
    expect(pixi.loadBundle.mock.calls.filter(([name]) => name === 'enemies')).toHaveLength(2)
    expect(useAssetsStore.getState().bundles.enemies.status).toBe('ready')
  })

  it('exposes real weighted progress and retries only failed bundles', async () => {
    const { ensureRunAssets, useAssetsStore, getRunAssetState } = await import('./assets')
    const failed = new Error('offline')
    let fail = true
    let progressSeen = 0
    pixi.loadBundle.mockImplementation(async (name, onProgress) => {
      onProgress(0.5)
      if (name === 'ship') progressSeen = useAssetsStore.getState().bundles.ship.progress
      if (name === 'loot' && fail) throw failed
    })
    await expect(ensureRunAssets()).rejects.toThrow('offline')
    expect(progressSeen).toBe(0.5)
    expect(getRunAssetState(useAssetsStore.getState().bundles)).toMatchObject({ status: 'error', error: failed })
    fail = false
    await ensureRunAssets()
    expect(pixi.loadBundle.mock.calls.map(([name]) => name)).toEqual(['ship', 'asteroids', 'loot', 'extraction', 'enemies', 'loot'])
    expect(getRunAssetState(useAssetsStore.getState().bundles)).toMatchObject({ status: 'ready', progress: 1 })
  })

  it('loads only menu resources before the shell and deduplicates shared URLs', async () => {
    const { ensureBundle } = await import('./assets')
    const { assetManifest, BUNDLE_URLS } = await import('./assetManifest')
    await ensureBundle('menu')
    expect(pixi.loadBundle.mock.calls.map(([name]) => name)).toEqual(['menu'])
    expect(BUNDLE_URLS.menu).toEqual(BUNDLE_URLS.loot)
    expect(assetManifest.bundles).toHaveLength(7)
    expect(assetManifest.bundles.flatMap((bundle) => bundle.assets)).not.toEqual(expect.arrayContaining([expect.objectContaining({ src: expect.stringContaining('/music/') })]))
    expect(pixi.loadBundle).toHaveBeenCalledTimes(1)
  })
})

describe('optional SFX loading', () => {
  it('loads files independently, shares pending requests and never retries at run start', async () => {
    const { ensureBundle, ensureRunAssets, useAssetsStore } = await import('./assets')
    const { BUNDLE_URLS } = await import('./assetManifest')
    const broken = BUNDLE_URLS.sfx[2]
    pixi.load.mockImplementation(async (url) => {
      if (url === broken) throw new Error('decode failed')
      return { isLoaded: true }
    })
    const first = ensureBundle('sfx')
    expect(ensureBundle('sfx')).toBe(first)
    await first
    expect(pixi.load).toHaveBeenCalledTimes(32)
    expect(useAssetsStore.getState().bundles.sfx).toMatchObject({ status: 'ready', progress: 1, failedUrls: [broken] })
    await ensureRunAssets()
    await ensureRunAssets()
    await ensureBundle('sfx')
    expect(pixi.load).toHaveBeenCalledTimes(32)
  })

  it('does not attempt unsupported OGG files or block required textures', async () => {
    const { utils } = await import('@pixi/sound')
    utils.supported.ogg = false
    try {
      const { preloadGameAssets, ensureBundle, ensureRunAssets, useAssetsStore } = await import('./assets')
      preloadGameAssets()
      await Promise.all([ensureRunAssets(), ensureBundle('sfx')])
      expect(pixi.load).not.toHaveBeenCalled()
      expect(useAssetsStore.getState().bundles.sfx.failedUrls).toHaveLength(32)
      expect(useAssetsStore.getState().bundles.ship.status).toBe('ready')
    } finally { utils.supported.ogg = true }
  })
})
