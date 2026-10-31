import type { ScoringConfig, EnemiesDestroyed } from '@/modules/runs/api/runsApi'

export function calculateScore(config: ScoringConfig, destroyed: ScoringConfig['asteroidPoints'], stageReached: number, enemiesDestroyed: EnemiesDestroyed = { sentryTurret: 0 }) {
  return destroyed.normal * config.asteroidPoints.normal
    + destroyed.fast * config.asteroidPoints.fast
    + destroyed.big * config.asteroidPoints.big
    + destroyed.armored * config.asteroidPoints.armored
    + (stageReached - 1) * config.stageBonus
    + enemiesDestroyed.sentryTurret * config.enemyPoints.sentryTurret
    + (enemiesDestroyed.shieldDrone ?? 0) * config.enemyPoints.shieldDrone
    + (enemiesDestroyed.mineLayer ?? 0) * config.enemyPoints.mineLayer
}
