import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import type { MineLayerConfig } from '@/game/core/enemyConfig'
import type { MineLayer } from '@/game/entities/MineLayer'

export class MineLayerView {
  readonly view = new Container()

  constructor(cfg: MineLayerConfig, texture: Texture) {
    const body = new Sprite(texture)
    body.anchor.set(0.5)
    // The image points up; the model's forward axis points right.
    body.width = cfg.height
    body.height = cfg.width
    body.rotation = Math.PI / 2
    this.view.addChild(body)
    if (import.meta.env.DEV || import.meta.env.ENV === 'debug') {
      this.view.addChild(new Graphics().circle(0, 0, cfg.radius)
        .stroke({ color: 0xff5555, width: 1, alpha: 0.55 }))
    }
  }

  sync(model: MineLayer) {
    this.view.position.set(model.position.x, model.position.y)
    this.view.rotation = model.direction === 1 ? 0 : Math.PI
    this.view.visible = model.active
  }

  destroy() { this.view.destroy({ children: true }) }
}
