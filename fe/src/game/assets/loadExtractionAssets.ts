import { Assets, Texture } from 'pixi.js'

import { EXTRACTION_ASSET_URLS } from '@/game/assets/extractionAssetUrls'

export type ExtractionAssets = {
  base: Texture
}

export async function loadExtractionAssets(): Promise<ExtractionAssets> {
  const urls = [EXTRACTION_ASSET_URLS.base]
  const loaded = (await Assets.load(urls)) as Record<string, Texture>

  return { base: loaded[EXTRACTION_ASSET_URLS.base] }
}

