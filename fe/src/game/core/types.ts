import type { Container } from 'pixi.js'

export type GameEventMap = Record<string, unknown>

export interface Scene {
  mount(root: Container): void
  update(dtMs: number): void
  destroy(): void
}

