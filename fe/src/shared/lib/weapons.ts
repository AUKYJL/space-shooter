export type WeaponId = 'basic_laser' | 'spread_shot' | 'shotgun' | 'plasma'

export type WeaponDef = {
  id: WeaponId
  title: string
  description: string
}

export const WEAPON_CATALOG: WeaponDef[] = [
  {
    id: 'basic_laser',
    title: 'Basic Laser',
    description: 'Reliable single-shot weapon.',
  },
  {
    id: 'spread_shot',
    title: 'Spread Shot',
    description: 'Fires a small cone of bullets.',
  },
  {
    id: 'shotgun',
    title: 'Shotgun',
    description: 'Wide cone, strong up close.',
  },
  {
    id: 'plasma',
    title: 'Plasma',
    description: 'Heavy shots with high impact.',
  },
]
