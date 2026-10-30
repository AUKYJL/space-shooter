import type { EventBus } from '@/game/core/EventBus';
import type { PlayerShip } from '@/game/entities/PlayerShip';
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact';

export type ViewportSize = { width: number; height: number }

export type FireState = {
  isFiring: boolean
  holdMs: number
}

export class InputSystem {
  private canvas: HTMLCanvasElement
  private player: PlayerShip
  private getViewportSize: () => ViewportSize
  private events: EventBus<RunBridgeEventMap>

  private isPointerDown = false
  private activePointerId: number | null = null
  private pointerDownAtMs: number | null = null
  private lastClientX = 0
  private lastClientY = 0
  private pendingClientDx = 0
  private pendingClientDy = 0
  private keysDown = new Set<string>()
  private moveSpeedPxPerSec = 320

  private isKeyboardFiring = false
  private keyboardFireDownAtMs: number | null = null

  constructor(options: {
    canvas: HTMLCanvasElement
    player: PlayerShip
    getViewportSize: () => ViewportSize
    events: EventBus<RunBridgeEventMap>
  }) {
    this.canvas = options.canvas
    this.player = options.player
    this.getViewportSize = options.getViewportSize
    this.events = options.events
  }

  mount() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown, { passive: true })
    this.canvas.addEventListener('pointermove', this.onPointerMove, { passive: true })
    this.canvas.addEventListener('pointerup', this.onPointerUp, { passive: true })
    this.canvas.addEventListener('pointercancel', this.onPointerUp, { passive: true })
    this.canvas.addEventListener('pointerleave', this.onPointerUp, { passive: true })
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  update(dtMs: number) {
    const { width, height } = this.getViewportSize()
    if (width <= 0 || height <= 0) return

    const radius = this.player.radius
    const minX = radius
    const maxX = Math.max(radius, width - radius)
    const minY = radius
    const maxY = Math.max(radius, height - radius)

    let nextX = this.player.view.position.x
    let nextY = this.player.view.position.y

    if (this.isPointerDown && (this.pendingClientDx !== 0 || this.pendingClientDy !== 0)) {
      const rect = this.canvas.getBoundingClientRect()
      const scaleX = rect.width > 0 ? width / rect.width : 1
      const scaleY = rect.height > 0 ? height / rect.height : 1

      const dx = this.pendingClientDx * scaleX
      const dy = this.pendingClientDy * scaleY

      this.pendingClientDx = 0
      this.pendingClientDy = 0

      nextX += dx
      nextY += dy
    }

    const axis = this.getMoveAxis()
    if (axis.x !== 0 || axis.y !== 0) {
      const speed = (this.moveSpeedPxPerSec * dtMs) / 1000
      nextX += axis.x * speed
      nextY += axis.y * speed
    }

    const clampedX = clamp(nextX, minX, maxX)
    const clampedY = clamp(nextY, minY, maxY)

    this.player.setPosition(clampedX, clampedY)
  }

  getFireState(nowMs: number = performance.now()): FireState {
    if (this.isPointerDown && this.pointerDownAtMs !== null) {
      return { isFiring: true, holdMs: Math.max(0, nowMs - this.pointerDownAtMs) }
    }
    if (this.isKeyboardFiring && this.keyboardFireDownAtMs !== null) {
      return { isFiring: true, holdMs: Math.max(0, nowMs - this.keyboardFireDownAtMs) }
    }
    return { isFiring: false, holdMs: 0 }
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerUp)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }

  private onPointerDown = (e: PointerEvent) => {
    // Only track a single "active" pointer for drag movement to avoid multi-touch teleporting.
    if (this.activePointerId !== null) return
    this.activePointerId = e.pointerId
    this.isPointerDown = true
    this.pointerDownAtMs = performance.now()
    this.lastClientX = e.clientX
    this.lastClientY = e.clientY
    this.pendingClientDx = 0
    this.pendingClientDy = 0

    // Capture this pointer so movement remains stable even if it drifts over UI overlays.
    try {
      this.canvas.setPointerCapture(e.pointerId)
    } catch {
      // no-op
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isPointerDown) return
    if (this.activePointerId === null) return
    if (e.pointerId !== this.activePointerId) return
    const dx = e.clientX - this.lastClientX
    const dy = e.clientY - this.lastClientY
    this.lastClientX = e.clientX
    this.lastClientY = e.clientY
    this.pendingClientDx += dx
    this.pendingClientDy += dy
  }

  private onPointerUp = (e: PointerEvent) => {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return
    this.isPointerDown = false
    this.activePointerId = null
    this.pointerDownAtMs = null
    this.pendingClientDx = 0
    this.pendingClientDy = 0

    try {
      this.canvas.releasePointerCapture(e.pointerId)
    } catch {
      // no-op
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      if (!e.repeat) {
        this.isKeyboardFiring = true
        this.keyboardFireDownAtMs = performance.now()
      }
      return
    }
    if (e.code === 'KeyX') {
      if (!e.repeat) this.events.emit('charge:activate', undefined)
      return
    }
    this.keysDown.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      this.isKeyboardFiring = false
      this.keyboardFireDownAtMs = null
      return
    }
    this.keysDown.delete(e.code)
  }

  private getMoveAxis() {
    const left = this.keysDown.has('ArrowLeft') || this.keysDown.has('KeyA')
    const right = this.keysDown.has('ArrowRight') || this.keysDown.has('KeyD')
    const up = this.keysDown.has('ArrowUp') || this.keysDown.has('KeyW')
    const down = this.keysDown.has('ArrowDown') || this.keysDown.has('KeyS')

    const x = (right ? 1 : 0) + (left ? -1 : 0)
    const y = (down ? 1 : 0) + (up ? -1 : 0)
    if (x === 0 && y === 0) return { x: 0, y: 0 }
    const len = Math.hypot(x, y) || 1
    return { x: x / len, y: y / len }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
