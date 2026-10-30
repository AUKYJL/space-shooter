import { Assets, Texture } from 'pixi.js'
import { SHIP_ASSET_URLS } from '@/game/assets/shipAssetUrls'

export type ShipAssets = {
  shipTexture: Texture
  flameTextures: Texture[]
}

export async function loadShipAssets(): Promise<ShipAssets> {
  const urls = [SHIP_ASSET_URLS.ship, ...SHIP_ASSET_URLS.flameFrames]
  const loaded = (await Assets.load(urls)) as Record<string, Texture>

  return {
    shipTexture: loaded[SHIP_ASSET_URLS.ship],
    flameTextures: SHIP_ASSET_URLS.flameFrames.map((u) => loaded[u]),
  }
}

