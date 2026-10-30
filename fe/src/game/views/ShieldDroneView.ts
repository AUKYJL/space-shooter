import { Container, Graphics } from 'pixi.js'
import type { ShieldDrone } from '@/game/entities/ShieldDrone'
import type { ShieldDroneConfig } from '@/game/core/enemyConfig'

export class ShieldDroneView {
  readonly view = new Container()

  constructor(cfg: ShieldDroneConfig) {
    this.view.addChild(new Graphics().poly([0, -cfg.radius, cfg.radius, 0, 0, cfg.radius, -cfg.radius, 0])
      .fill(cfg.color).stroke({ width: cfg.outlineWidth, color: cfg.outlineColor }))
  }

  sync(model: ShieldDrone) {
    this.view.position.set(model.position.x, model.position.y)
    this.view.visible = model.active
  }

  destroy() { this.view.destroy({ children: true }) }
}
