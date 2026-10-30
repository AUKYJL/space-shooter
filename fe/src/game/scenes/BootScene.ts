import { Container } from 'pixi.js'

import type { Scene } from '@/game/core/types'

export class BootScene implements Scene {
  mount(root: Container) {
    void root
  }
  update(dtMs: number) {
    void dtMs
  }
  destroy() {}
}
