import { validateRunConfig, validateRunStart } from "./validateRunConfig"
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { qk } from '@/shared/api/queryKeys'
import type { MeResponse } from '@/modules/profile/api/profileApi'
import { finishRun, getRunConfig, getRunHistory, startRun } from './runsApi'

const configOptions = {
  queryKey: qk.runConfig(),
  queryFn: async () => {
    const config = await getRunConfig()
    validateRunConfig(config)
    return config
  },
  staleTime: Infinity,
  retry: false as const,
}

export function useRunConfigQuery(enabled = true) {
  return useQuery({ ...configOptions, enabled })
}

export function useRunHistoryQuery(limit?: number) {
  return useQuery({ queryKey: qk.runsHistory(), queryFn: () => getRunHistory(limit) })
}

export function useStartRunMutation() {
  return useMutation({
    mutationFn: async ({ weaponId }: { weaponId: string }) => {
      const result = await startRun({ weaponId })
      validateRunStart(result)
      return structuredClone({ ...result, scoringConfig: result.snapshot.scoringConfig })
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
