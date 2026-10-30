import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/shared/api/queryKeys'
import { ApiError } from '@/shared/api/client'
import type { MeResponse } from '@/modules/profile/api/profileApi'
import { finishRun, getRunConfig, getRunHistory, startRun } from './runsApi'

const configOptions = {
  queryKey: qk.runConfig(), queryFn: getRunConfig, staleTime: Infinity, retry: false as const,
}

export function useRunConfigQuery(enabled = true) {
  return useQuery({ ...configOptions, enabled })
}

export function useRunHistoryQuery(limit?: number) {
  return useQuery({ queryKey: qk.runsHistory(), queryFn: () => getRunHistory(limit) })
}

export function useStartRunMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ weaponId }: { weaponId: string }) => {
      let config = await qc.fetchQuery(configOptions)
      try {
        const result = await startRun({ weaponId, scoringConfigVersion: config.version })
        return { ...result, scoringConfig: structuredClone(config) }
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error
        await qc.invalidateQueries({ queryKey: qk.runConfig(), refetchType: 'none' })
        config = await qc.fetchQuery(configOptions)
        const result = await startRun({ weaponId, scoringConfigVersion: config.version })
        return { ...result, scoringConfig: structuredClone(config) }
      }
    },
  })
}

export function useFinishRunMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: finishRun,
    onSuccess: async (result) => {
      qc.setQueryData<MeResponse>(qk.me(), (previous) => previous
        ? { ...previous, bestScore: Math.max(previous.bestScore ?? 0, result.bestScore) } : previous)
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.me(), exact: true }),
        qc.invalidateQueries({ queryKey: qk.currencies() }),
        qc.invalidateQueries({ queryKey: qk.runsHistory() }),
      ])
    },
  })
}
