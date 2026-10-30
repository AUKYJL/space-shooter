import { Container, Graphics } from 'pixi.js'
import type { MineLayerConfig } from '@/game/core/enemyConfig'
import type { MineLayer } from '@/game/entities/MineLayer'

export class MineLayerView {
  readonly view = new Container()

  constructor(cfg: MineLayerConfig) {
    const triangle = new Graphics().poly([
      cfg.width / 2, 0, -cfg.width / 2, -cfg.height / 2, -cfg.width / 2, cfg.height / 2,
    ]).fill(cfg.color).stroke({ width: cfg.outlineWidth, color: cfg.outlineColor })
    this.view.addChild(triangle)
  }

  sync(model: MineLayer) {
    this.view.position.set(model.position.x, model.position.y)
    this.view.rotation = model.direction === 1 ? 0 : Math.PI
    this.view.visible = model.active
  }

  destroy() { this.view.destroy({ children: true }) }
}
