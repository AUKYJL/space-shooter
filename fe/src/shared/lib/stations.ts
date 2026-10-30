export type StationId = 'coin_station' | 'ore_station' | 'crystal_station'

export type StationDef = {
  id: StationId
  title: string
  description: string
  cycleMs: number
  rewards: {
    coins?: number
    iron?: number
    crystals?: number
  }
}

export type StationSlot = {
  assignedStationId?: StationId
  startedAt?: number
  endsAt?: number
}

export const STATION_CATALOG: StationDef[] = [
  {
    id: 'coin_station',
    title: 'Coin Extractor',
    description: 'Passive coin generation.',
    cycleMs: 6 * 60 * 60 * 1000,
    rewards: { coins: 1200 },
  },
  {
    id: 'ore_station',
    title: 'Ore Refinery',
    description: 'Refines iron over time.',
    cycleMs: 6 * 60 * 60 * 1000,
    rewards: { iron: 25 },
  },
  {
    id: 'crystal_station',
    title: 'Crystal Harvester',
    description: 'Produces crystals slowly.',
    cycleMs: 6 * 60 * 60 * 1000,
    rewards: { crystals: 18 },
  },
]

export function getStationDef(id: StationId) {
  return STATION_CATALOG.find((s) => s.id === id) ?? null
}

export function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

