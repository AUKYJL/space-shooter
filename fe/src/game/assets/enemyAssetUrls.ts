export const ENEMY_ASSET_URLS = {
  sentryPlatform: new URL('../../assets/enemies/sentry-platform.png', import.meta.url).href,
  sentryCannon: new URL('../../assets/enemies/sentry-cannon.png', import.meta.url).href,
  shieldDrone: new URL('../../assets/enemies/shield-drone.png', import.meta.url).href,
  mineLayer: new URL('../../assets/enemies/mine-layer.png', import.meta.url).href,
  mineIdle: new URL('../../assets/enemies/space-mine-idle.png', import.meta.url).href,
  mineActive: new URL('../../assets/enemies/space-mine-active.png', import.meta.url).href,
  projectile: new URL('../../assets/enemies/enemy-projectile.png', import.meta.url).href,
} as const
