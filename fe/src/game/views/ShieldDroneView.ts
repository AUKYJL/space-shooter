import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import type { ShieldDrone } from '@/game/entities/ShieldDrone'
import type { ShieldDroneConfig } from '@/game/core/enemyConfig'

export class ShieldDroneView {
  readonly view = new Container()

  constructor(cfg: ShieldDroneConfig, texture: Texture) {
    const body = new Sprite(texture)
    body.anchor.set(0.5)
    body.width = body.height = cfg.radius * 2
    this.view.addChild(body)
    if (import.meta.env.DEV || import.meta.env.ENV === 'debug') {
      this.view.addChild(new Graphics().circle(0, 0, cfg.radius)
        .stroke({ color: 0xff5555, width: 1, alpha: 0.55 }))
    }
  }

  sync(model: ShieldDrone) {
    this.view.position.set(model.position.x, model.position.y)
    this.view.visible = model.active
  }

  destroy() { this.view.destroy({ children: true }) }
}
