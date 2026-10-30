export class CameraSystem {
  private shakeRemainingMs = 0
  private shakeDurationMs = 0
  private shakeAmplitudePx = 0
  private tMs = 0

  shake(options: { durationMs: number; amplitudePx: number }) {
    const durationMs = Math.max(0, options.durationMs)
    const amplitudePx = Math.max(0, options.amplitudePx)
    if (durationMs <= 0 || amplitudePx <= 0) return

    this.shakeDurationMs = durationMs
    this.shakeRemainingMs = durationMs
    this.shakeAmplitudePx = amplitudePx
  }

  update(dtMs: number) {
    if (this.shakeRemainingMs <= 0) return
    this.tMs += dtMs
    this.shakeRemainingMs = Math.max(0, this.shakeRemainingMs - dtMs)
  }

  getOffset(): { x: number; y: number } {
    if (this.shakeRemainingMs <= 0 || this.shakeDurationMs <= 0 || this.shakeAmplitudePx <= 0) return { x: 0, y: 0 }

    const progress = 1 - this.shakeRemainingMs / this.shakeDurationMs
    const strength = Math.max(0, 1 - progress)

    const ax = this.shakeAmplitudePx * strength
    const ay = this.shakeAmplitudePx * strength

    const x = Math.round(Math.sin(this.tMs * 0.05) * ax)
    const y = Math.round(Math.cos(this.tMs * 0.08) * ay)

    return { x, y }
  }
}

