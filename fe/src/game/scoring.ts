import type { ScoringConfig } from '@/modules/runs/api/runsApi'

export function calculateScore(config: ScoringConfig, destroyed: ScoringConfig['asteroidPoints'], stageReached: number) {
  return destroyed.normal * config.asteroidPoints.normal
    + destroyed.fast * config.asteroidPoints.fast
    + destroyed.big * config.asteroidPoints.big
    + destroyed.armored * config.asteroidPoints.armored
    + (stageReached - 1) * config.stageBonus
}
