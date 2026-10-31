import { Container, Graphics, Sprite } from 'pixi.js'
import type { EnemyAssets } from '@/game/assets/loadEnemyAssets'
import type { MineConfig } from '@/game/core/enemyConfig'
import type { Mine } from '@/game/entities/Mine'

export class MineView {
  readonly view = new Container()
  private body: Sprite
  private explosion: Graphics
  private debugGfx?: Graphics

  private readonly config: MineConfig

  private readonly textures: Pick<EnemyAssets, 'mineIdle' | 'mineActive'>

  constructor(config: MineConfig, textures: Pick<EnemyAssets, 'mineIdle' | 'mineActive'>) {
    this.textures = textures
    this.config = config
    this.body = new Sprite(textures.mineIdle)
    this.body.anchor.set(0.5)
    this.body.width = this.body.height = config.radius * 2
    this.explosion = new Graphics().circle(0, 0, config.blastRadius)
      .stroke({ width: config.outlineWidth, color: config.explosionColor, alpha: config.explosionAlpha })
    this.view.addChild(this.body, this.explosion)
    if (import.meta.env.DEV || import.meta.env.ENV === 'debug') {
      this.debugGfx = new Graphics().circle(0, 0, config.radius)
        .stroke({ color: 0xff5555, width: 1, alpha: 0.55 })
      this.view.addChild(this.debugGfx)
    }
  }

  sync(model: Mine) {
    this.view.position.set(model.position.x, model.position.y)
    this.view.visible = model.visible
    const texture = model.state === 'armed' && model.blinkOn ? this.textures.mineActive : this.textures.mineIdle
    if (this.body.texture !== texture) {
      this.body.texture = texture
      this.body.width = this.body.height = this.config.radius * 2
    }
    this.body.visible = model.active
    this.body.alpha = model.state === 'dormant' ? this.config.dormantAlpha
      : model.blinkOn ? 1 : this.config.blinkAlpha
    this.explosion.visible = model.state === 'exploding'
    if (this.debugGfx) this.debugGfx.visible = model.active
  }

  destroy() { this.view.destroy({ children: true }) }
}
