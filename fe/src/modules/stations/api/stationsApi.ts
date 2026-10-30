import { requestJson } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'

export type StationCatalogItem = {
  id: string
  name: string
  resourceType: string
  baseAmountPerCycle: number
  cycleDurationHours: number
  unlockCostJson: unknown
}

export type StationSlot = {
  id: string
  slotIndex: number
  assignedStationId: string | null
  startedAt: string | null
  endsAt: string | null
  lastCollectedAt: string | null
}

export type UnlockStationResponse = {
  id: string
  userId: string
  stationId: string
  unlockedAt: string
}

export function getStationsCatalog() {
  return requestJson<StationCatalogItem[]>({ method: 'GET', url: endpoints.stations.catalog() })
}

export function getStationsUnlocks() {
  return requestJson<Array<{ stationId: string }>>({ method: 'GET', url: endpoints.stations.unlocks() })
}

export function getStationSlots() {
  return requestJson<StationSlot[]>({ method: 'GET', url: endpoints.stations.slots() })
}

export function unlockSlot() {
  return requestJson<StationSlot>({ method: 'POST', url: endpoints.stations.unlockSlot() })
}

export function unlockStation(body: { stationId: string }) {
  return requestJson<UnlockStationResponse>({ method: 'POST', url: endpoints.stations.unlock(), data: body })
}

export function assignStation(slotId: string, body: { stationId: string }) {
  return requestJson<StationSlot>({ method: 'POST', url: endpoints.stations.assign(slotId), data: body })
}

export function startStation(slotId: string) {
  return requestJson<StationSlot>({ method: 'POST', url: endpoints.stations.start(slotId) })
}

export function collectStation(slotId: string) {
  return requestJson<{ granted: { resourceType: string; amount: number } }>({
    method: 'POST',
    url: endpoints.stations.collect(slotId),
  })
}

