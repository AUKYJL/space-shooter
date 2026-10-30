import type { EnemyConfigs } from '@/game/core/enemyConfig'
import { requestJson } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'

export type EnemiesDestroyed = { sentryTurret: number; shieldDrone?: number }

export type ScoringConfig = {
  version: number
  enemies?: EnemyConfigs
  asteroidPoints: { normal: number; fast: number; big: number; armored: number }
  stageBonus: number
  enemyPoints?: { sentryTurret: number; shieldDrone?: number }
}

export type StartRunRequest = { weaponId: string; scoringConfigVersion: number }
export type StartRunResponse = {
  runId: string
  seed: number
  scoringConfigVersion: number
  snapshot: { weaponId: string; damage: number; fireRate: number; maxHp: number; scoringConfig: ScoringConfig }
}

export type FinishRunRequest = {
  runId: string
  durationMs: number
  endedBy: 'death' | 'extract'
  extractionCount: number
  rewardMultiplier: number
  summary: {
    asteroidsDestroyed: number
    destroyedByType: ScoringConfig['asteroidPoints']
    enemiesDestroyed?: EnemiesDestroyed
    stageReached: number
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
  score: number | null
  bestScore: number
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
  result: { accepted: boolean; score: number | null; summary: unknown; grantedRewards: unknown } | null
}

export function getRunConfig() {
  return requestJson<ScoringConfig>({ method: 'GET', url: endpoints.runs.config() })
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

