import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/shared/api/queryKeys'
import {
  assignStation,
  collectStation,
  getStationSlots,
  getStationsCatalog,
  getStationsUnlocks,
  startStation,
  unlockSlot,
  unlockStation,
} from './stationsApi'

export function useStationsCatalogQuery() {
  return useQuery({ queryKey: qk.stationsCatalog(), queryFn: getStationsCatalog })
}

export function useStationsUnlocksQuery() {
  return useQuery({ queryKey: qk.stationsUnlocks(), queryFn: getStationsUnlocks })
}

export function useStationSlotsQuery() {
  return useQuery({ queryKey: qk.stationsSlots(), queryFn: getStationSlots })
}

export function useUnlockSlotMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unlockSlot,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.stationsSlots() }),
        qc.invalidateQueries({ queryKey: qk.currencies() }),
      ])
    },
  })
}

export function useUnlockStationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unlockStation,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.stationsUnlocks() }),
        qc.invalidateQueries({ queryKey: qk.currencies() }),
      ])
    },
  })
}

export function useAssignStationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slotId, stationId }: { slotId: string; stationId: string }) =>
      assignStation(slotId, { stationId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.stationsSlots() })
    },
  })
}

export function useStartStationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slotId }: { slotId: string }) => startStation(slotId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.stationsSlots() })
    },
  })
}

export function useCollectStationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slotId }: { slotId: string }) => collectStation(slotId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.stationsSlots() }),
        qc.invalidateQueries({ queryKey: qk.currencies() }),
      ])
    },
  })
}

