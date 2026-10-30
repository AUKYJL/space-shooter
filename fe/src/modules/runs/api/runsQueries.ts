import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/shared/api/queryKeys'
import { finishRun, getRunHistory, startRun } from './runsApi'

export function useRunHistoryQuery(limit?: number) {
  return useQuery({
    queryKey: qk.runsHistory(),
    queryFn: () => getRunHistory(limit),
  })
}

export function useStartRunMutation() {
  return useMutation({ mutationFn: startRun })
}

export function useFinishRunMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: finishRun,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.currencies() }),
        qc.invalidateQueries({ queryKey: qk.runsHistory() }),
      ])
    },
  })
}

