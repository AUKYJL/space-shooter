import { Assets, type Texture } from 'pixi.js'
import { ensureBundle } from './assets'

import { EXTRACTION_ASSET_URLS } from '@/game/assets/extractionAssetUrls'

export type ExtractionAssets = {
  base: Texture
}

export async function loadExtractionAssets(): Promise<ExtractionAssets> {
  await ensureBundle('extraction')

  return { base: Assets.get<Texture>(EXTRACTION_ASSET_URLS.base) }
}

