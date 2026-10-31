// Explicit textures for runtime tests; production always uses the shared Assets cache.
import { Texture, TextureSource } from 'pixi.js'
import type { EnemyAssets } from '@/game/assets/loadEnemyAssets'

export const ENEMY_ASSETS: EnemyAssets = {
  sentryPlatform: new Texture({ source: new TextureSource({ width: 256, height: 256 }) }),
  sentryCannon: new Texture({ source: new TextureSource({ width: 258, height: 258 }) }),
  shieldDrone: new Texture({ source: new TextureSource({ width: 261, height: 256 }) }),
  mineLayer: new Texture({ source: new TextureSource({ width: 256, height: 256 }) }),
  mineIdle: new Texture({ source: new TextureSource({ width: 256, height: 256 }) }),
  mineActive: new Texture({ source: new TextureSource({ width: 256, height: 256 }) }),
  projectile: new Texture({ source: new TextureSource({ width: 261, height: 256 }) }),
}
