import { requestJson } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'

export type StartRunRequest = { weaponId: string }
export type StartRunResponse = {
  runId: string
  seed: number
  snapshot: { weaponId: string; damage: number; fireRate: number; maxHp: number }
}

export type FinishRunRequest = {
  runId: string
  durationMs: number
  endedBy: string
  extractionCount: number
  rewardMultiplier: number
  summary: {
    asteroidsDestroyed: number
    largeAsteroidsDestroyed?: number
    armoredAsteroidsDestroyed?: number
    rareAsteroidsDestroyed?: number
    coinsCollected: number
    resourcesCollected: { ore: number; crystal: number }
  }
  extra?: Record<string, unknown>
}

export type FinishRunResponse = {
  accepted: boolean
  grantedRewards: { coins: number; resources: { ore: number; crystal: number } }
}

export type RunHistoryItem = {
  runId: string
  seed: number
  weaponId: string
  startedAt: string
  finishedAt: string | null
  endedBy: string | null
  extractionCount: number | null
  rewardMultiplier: number | null
  status: string
  result: { accepted: boolean; summary: unknown; grantedRewards: unknown } | null
}

export function startRun(body: StartRunRequest) {
  return requestJson<StartRunResponse>({ method: 'POST', url: endpoints.runs.start(), data: body })
}

export function finishRun(body: FinishRunRequest) {
  return requestJson<FinishRunResponse>({ method: 'POST', url: endpoints.runs.finish(), data: body })
}

export function getRunHistory(limit?: number) {
  const qs = typeof limit === 'number' ? `?limit=${encodeURIComponent(String(limit))}` : ''
  return requestJson<RunHistoryItem[]>({ method: 'GET', url: `${endpoints.runs.history()}${qs}` })
}

