import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/shared/api/queryKeys'
import { getLoadout, patchWeapon } from './loadoutApi'

export function useLoadoutQuery() {
  return useQuery({
    queryKey: qk.loadout(),
    queryFn: getLoadout,
  })
}

export function usePatchWeaponMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: patchWeapon,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.loadout() }),
        qc.invalidateQueries({ queryKey: qk.currencies() }),
        qc.invalidateQueries({ queryKey: qk.progression() }),
      ])
    },
  })
}

