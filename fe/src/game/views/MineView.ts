import { Container, Graphics } from 'pixi.js'
import type { MineConfig } from '@/game/core/enemyConfig'
import type { Mine } from '@/game/entities/Mine'

export class MineView {
  readonly view = new Container()
  private body: Graphics
  private explosion: Graphics

  private readonly config: MineConfig

  constructor(config: MineConfig) {
    this.config = config
    this.body = new Graphics().circle(0, 0, config.radius).fill(config.color)
    this.explosion = new Graphics().circle(0, 0, config.blastRadius)
      .stroke({ width: config.outlineWidth, color: config.explosionColor, alpha: config.explosionAlpha })
    this.view.addChild(this.body, this.explosion)
  }

  sync(model: Mine) {
    this.view.position.set(model.position.x, model.position.y)
    this.view.visible = model.visible
    this.body.visible = model.active
    this.body.alpha = model.state === 'dormant' ? this.config.dormantAlpha
      : model.blinkOn ? 1 : this.config.blinkAlpha
    this.explosion.visible = model.state === 'exploding'
  }

  destroy() { this.view.destroy({ children: true }) }
}
