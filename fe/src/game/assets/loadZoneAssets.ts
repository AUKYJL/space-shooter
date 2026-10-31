import { Assets, type Texture } from 'pixi.js'
import { ensureBundle } from './assets'
import { ZONE_ASSET_URLS } from './zoneAssetUrls'

export type ZoneAssets = { heal: Texture; danger: Texture }

export async function loadZoneAssets(): Promise<ZoneAssets> {
  await ensureBundle('zones')
  return {
    heal: Assets.get<Texture>(ZONE_ASSET_URLS.heal),
    danger: Assets.get<Texture>(ZONE_ASSET_URLS.danger),
  }
}
