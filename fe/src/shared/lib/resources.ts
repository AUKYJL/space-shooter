import coinIcon from '@/assets/resources/coin.png'
import crystalIcon from '@/assets/resources/crystal.png'
import shardIcon from '@/assets/resources/shard.png'
import ironIcon from '@/assets/resources/iron.png'

export type ResourceId = 'coins' | 'iron' | 'crystals'

export function getResourceIconUrl(id: ResourceId): string {
  if (id === 'coins') return coinIcon
  if (id === 'crystals') return shardIcon
  if (id === 'iron') return ironIcon
  return crystalIcon
}
