export const SHIP_ASSET_URLS = {
  ship: new URL('../../assets/ship/ship.png', import.meta.url).href,
  flameFrames: [
    new URL('../../assets/ship/flame01.png', import.meta.url).href,
    new URL('../../assets/ship/flame02.png', import.meta.url).href,
    new URL('../../assets/ship/flame03.png', import.meta.url).href,
    new URL('../../assets/ship/flame04.png', import.meta.url).href,
  ],
} as const

