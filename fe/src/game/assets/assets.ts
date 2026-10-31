import { Assets } from 'pixi.js'
import { create } from 'zustand'
import { assetManifest, BUNDLE_URLS, RUN_BUNDLES, type AssetBundle } from './assetManifest'

export type AssetLoadState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  progress: number
  error: Error | null
  failedUrls?: string[]
}

const initialState = (): AssetLoadState => ({ status: 'idle', progress: 0, error: null })
export const useAssetsStore = create<{ bundles: Record<AssetBundle, AssetLoadState> }>(() => ({
  bundles: Object.fromEntries(Object.keys(BUNDLE_URLS).map((name) => [name, initialState()])) as Record<AssetBundle, AssetLoadState>,
}))

let initialization: Promise<void> | undefined
const pending = new Map<AssetBundle, Promise<void>>()

function update(bundle: AssetBundle, state: Partial<AssetLoadState>) {
  useAssetsStore.setState(({ bundles }) => ({ bundles: { ...bundles, [bundle]: { ...bundles[bundle], ...state } } }))
}

export function initializeAssets() {
  initialization ??= Assets.init({ manifest: assetManifest }).catch((error: unknown) => {
    initialization = undefined
    throw error
  })
  return initialization
}

export function ensureBundle(bundle: AssetBundle): Promise<void> {
  const existing = pending.get(bundle)
  if (existing) return existing
  if (useAssetsStore.getState().bundles[bundle].status === 'ready') return Promise.resolve()

  update(bundle, { status: 'loading', progress: 0, error: null })
  const promise = initializeAssets()
    .then(async () => {
      // Pixi reports NaN progress for an empty bundle; these optional catalogs are ready immediately.
      if (bundle === 'sfx') {
        // Import registers the sound parser before any OGG enters the shared cache.
        const { utils } = await import('@pixi/sound')
        let completed = 0
        const failedUrls: string[] = []
        await Promise.all(BUNDLE_URLS.sfx.map(async (url) => {
          try {
            if (!utils.supported.ogg) throw new Error('OGG unsupported')
            await Assets.load(url)
          } catch { failedUrls.push(url) }
          update(bundle, { progress: ++completed / BUNDLE_URLS.sfx.length })
        }))
        update(bundle, { failedUrls })
      } else if (BUNDLE_URLS[bundle].length) {
        await Assets.loadBundle(bundle, (progress) => update(bundle, { progress }))
      }
      update(bundle, { status: 'ready', progress: 1 })
    })
    .catch((cause: unknown) => {
      const error = cause instanceof Error ? cause : new Error(String(cause))
      update(bundle, { status: 'error', error })
      throw error
    })
    .finally(() => pending.delete(bundle))
  pending.set(bundle, promise)
  return promise
}

export function ensureRunAssets() {
  return Promise.all(RUN_BUNDLES.map(ensureBundle)).then(() => undefined)
}

export function getRunAssetState(bundles: Record<AssetBundle, AssetLoadState>): AssetLoadState {
  const states = RUN_BUNDLES.map((bundle) => bundles[bundle])
  const total = RUN_BUNDLES.reduce((sum, bundle) => sum + BUNDLE_URLS[bundle].length, 0)
  return {
    status: states.every((state) => state.status === 'ready') ? 'ready'
      : states.some((state) => state.status === 'error') ? 'error'
      : states.some((state) => state.status === 'loading') ? 'loading' : 'idle',
    progress: RUN_BUNDLES.reduce((sum, bundle) => sum + bundles[bundle].progress * BUNDLE_URLS[bundle].length, 0) / total,
    error: states.find((state) => state.error)?.error ?? null,
  }
}

export function preloadGameAssets(): void {
  void ensureRunAssets().catch(() => {})
  void ensureBundle('sfx').catch(() => {})
}
