import { Assets, type Texture } from 'pixi.js'
import { ensureBundle } from './assets'
import { SHIP_ASSET_URLS } from '@/game/assets/shipAssetUrls'

export type ShipAssets = {
  shipTexture: Texture
  flameTextures: Texture[]
}

export async function loadShipAssets(): Promise<ShipAssets> {
  await ensureBundle('ship')

  return {
    shipTexture: Assets.get<Texture>(SHIP_ASSET_URLS.ship),
    flameTextures: SHIP_ASSET_URLS.flameFrames.map((u) => Assets.get<Texture>(u)),
  }
}

