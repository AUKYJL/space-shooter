import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/shared/api/queryKeys'
import { buyUpgrade, getUpgrades } from './upgradesApi'

export function useUpgradesQuery() {
  return useQuery({ queryKey: qk.upgrades(), queryFn: getUpgrades })
}

export function useBuyUpgradeMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: buyUpgrade,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.currencies() }),
        qc.invalidateQueries({ queryKey: qk.upgrades() }),
        qc.invalidateQueries({ queryKey: qk.progression() }),
      ])
    },
  })
}

