import type { DifficultyConfig } from '@/game/core/gameplayConfig'
import type { AsteroidType } from '@/game/entities/Asteroid'
import type { SpawnTuning } from '@/game/systems/SpawnSystem'

export class DifficultySystem {
  private config: DifficultyConfig

  constructor(config: DifficultyConfig) {
    this.config = config
  }

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
    return 1 + (this.stage - 1) * this.config.stageMultiplierStep
  }

  getSpawnTuning(): SpawnTuning {
    // MVP curve: ramps over ~4 minutes.
    const t = clamp01(this.elapsedMs / this.config.rampMs)
    const stageMul = this.getStageMultiplier()
    const stageT = clamp01((this.stage - 1) / this.config.compositionStageSpan)

    const spawnEveryMs = lerp(this.config.spawnEveryMs.start, this.config.spawnEveryMs.end, t) / stageMul
    const maxActive = lerp(this.config.maxActive.start, this.config.maxActive.end, t) * Math.min(this.config.maxActiveStageMultiplier, stageMul)

    // Shift composition towards tougher types over time.
    const base: Record<AsteroidType, number> = {
      normal: lerp(this.config.composition.normal.start, this.config.composition.normal.end, t),
      fast: lerp(this.config.composition.fast.start, this.config.composition.fast.end, t),
      big: lerp(this.config.composition.big.start, this.config.composition.big.end, t),
      armored: lerp(this.config.composition.armored.start, this.config.composition.armored.end, t),
    }

    // Stage further biases towards tougher asteroids (big/armored).
    const weights: Record<AsteroidType, number> = {
      normal: base.normal * lerp(1, this.config.composition.normal.stageEnd, stageT),
      fast: base.fast * lerp(1, this.config.composition.fast.stageEnd, stageT),
      big: base.big * lerp(1, this.config.composition.big.stageEnd, stageT),
      armored: base.armored * lerp(1, this.config.composition.armored.stageEnd, stageT),
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
