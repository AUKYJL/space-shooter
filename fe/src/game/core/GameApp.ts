import { Application, Container } from 'pixi.js'

import type { Scene } from '@/game/core/types'
import { GameLoop } from '@/game/core/GameLoop'

export type GameAppOptions = {
  backgroundAlpha?: number
}

export class GameApp {
  private containerEl: HTMLElement
  private app: Application
  private root: Container
  private loop: GameLoop
  private resizeObserver: ResizeObserver | null = null
  private scene: Scene | null = null
  private initialResizeRaf: number | null = null

  private constructor(containerEl: HTMLElement, app: Application) {
    this.containerEl = containerEl
    this.app = app
    this.root = new Container()
    this.app.stage.addChild(this.root)
    this.loop = new GameLoop(this.app, (dtMs) => this.update(dtMs))
  }

  static async create(containerEl: HTMLElement, options: GameAppOptions = {}) {
    const app = new Application()

    try {
      await app.init({
        backgroundAlpha: options.backgroundAlpha ?? 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        resizeTo: containerEl,
      })
    } catch (error) {
      if (app.renderer) app.destroy(true)
      throw error
    }

    containerEl.appendChild(app.canvas)
    const instance = new GameApp(containerEl, app)
    instance.bindResize()
    instance.ensureInitialNonZeroResize()
    instance.loop.start()
    return instance
  }

  private forceResize() {
    const { clientWidth, clientHeight } = this.containerEl
    if (clientWidth > 0 && clientHeight > 0) {
      this.app.renderer.resize(clientWidth, clientHeight)
      return true
    }
    return false
  }

  private ensureInitialNonZeroResize() {
    // On first navigation the host can briefly be 0x0 without triggering a reliable resize event.
    // Retry a few frames so we don't end up with a permanently 0-sized renderer/canvas.
    let triesLeft = 10
    const tick = () => {
      this.initialResizeRaf = null
      if (this.forceResize()) return
      triesLeft -= 1
      if (triesLeft <= 0) return
      this.initialResizeRaf = window.requestAnimationFrame(tick)
    }

    tick()
  }

  private bindResize() {
    if (typeof ResizeObserver === 'undefined') return
    this.resizeObserver = new ResizeObserver(() => {
      // In some layouts resizeTo won't fire reliably; force a renderer resize.
      this.forceResize()
    })
    this.resizeObserver.observe(this.containerEl)
    // Kick once in case the observer doesn't fire immediately.
    this.forceResize()
  }

  setScene(scene: Scene | null) {
    if (this.scene) {
      this.scene.destroy()
      this.root.removeChildren()
    }

    this.scene = scene
    if (!scene) return
    scene.mount(this.root)
  }

  private update(dtMs: number) {
    this.scene?.update(dtMs)
  }

  destroy() {
    if (this.initialResizeRaf != null) {
      window.cancelAnimationFrame(this.initialResizeRaf)
      this.initialResizeRaf = null
    }
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.setScene(null)
    this.loop.destroy()
    this.app.destroy(true)
    this.containerEl.replaceChildren()
  }

  pause() {
    this.loop.pause()
  }

  resume() {
    this.loop.resume()
  }

  getCanvas() {
    return this.app.canvas
  }

  getViewportSize() {
    return { width: this.app.renderer.width, height: this.app.renderer.height }
  }
}
