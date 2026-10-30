import type { AsteroidType } from '@/game/entities/Asteroid'
import type { SpawnTuning } from '@/game/systems/SpawnSystem'

export class DifficultySystem {
  elapsedMs = 0
  private stage = 1

  update(dtMs: number) {
    this.elapsedMs += dtMs
  }

  getStage() {
    return this.stage
  }

  advanceStage() {
    this.stage += 1
  }

  getStageMultiplier() {
    return 1 + (this.stage - 1) * 0.15
  }

  getSpawnTuning(): SpawnTuning {
    // MVP curve: ramps over ~4 minutes.
    const t = clamp01(this.elapsedMs / (4 * 60 * 1000))
    const stageMul = this.getStageMultiplier()
    const stageT = clamp01((this.stage - 1) / 6)

    const spawnEveryMs = lerp(420, 230, t) / stageMul
    const maxActive = lerp(26, 44, t) * Math.min(1.35, stageMul)

    // Shift composition towards tougher types over time.
    const base: Record<AsteroidType, number> = {
      normal: lerp(0.7, 0.45, t),
      fast: lerp(0.16, 0.24, t),
      big: lerp(0.1, 0.18, t),
      armored: lerp(0.04, 0.13, t),
    }

    // Stage further biases towards tougher asteroids (big/armored).
    const weights: Record<AsteroidType, number> = {
      normal: base.normal * lerp(1, 0.72, stageT),
      fast: base.fast * lerp(1, 1.05, stageT),
      big: base.big * lerp(1, 1.45, stageT),
      armored: base.armored * lerp(1, 1.8, stageT),
    }

    return {
      spawnEveryMs,
      maxActive,
      typeWeights: weights,
      stageMultiplier: stageMul,
    }
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clamp01(v: number) {
  if (v <= 0) return 0
  if (v >= 1) return 1
  return v
}
