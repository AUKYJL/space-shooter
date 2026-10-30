import type { Application } from 'pixi.js'

export type UpdateFn = (dtMs: number) => void

export class GameLoop {
  private app: Application
  private update: UpdateFn
  private running = false
  private paused = false
  private tick = (ticker: { deltaMS: number }) => {
    if (!this.running) return
    if (this.paused) return
    this.update(ticker.deltaMS)
  }

  constructor(app: Application, update: UpdateFn) {
    this.app = app
    this.update = update
  }

  start() {
    if (this.running) return
    this.running = true
    this.app.ticker.add(this.tick)
  }

  stop() {
    if (!this.running) return
    this.running = false
    this.app.ticker.remove(this.tick)
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }

  isPaused() {
    return this.paused
  }

  destroy() {
    this.stop()
  }
}
