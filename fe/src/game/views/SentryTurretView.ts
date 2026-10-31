import { Container, Graphics, Sprite } from 'pixi.js'
import type { EnemyAssets } from '@/game/assets/loadEnemyAssets'
import type { SentryTurret } from '@/game/entities/SentryTurret'
import type { SentryTurretConfig, ShieldDroneConfig } from '@/game/core/enemyConfig'

export class SentryTurretView {
  readonly view = new Container()
  readonly shield = new Graphics()
  private platform: Sprite
  private cannon: Sprite
  private hp = new Graphics()
  private lastHp = -1

  private config: SentryTurretConfig

  constructor(cfg: SentryTurretConfig, shieldCfg: ShieldDroneConfig, textures: Pick<EnemyAssets, 'sentryPlatform' | 'sentryCannon'>) {
    this.config = cfg
    this.shield.circle(0, 0, shieldCfg.shieldRadius)
      .stroke({ width: shieldCfg.shieldWidth, color: shieldCfg.color, alpha: shieldCfg.shieldAlpha })
    this.shield.visible = false
    this.platform = new Sprite(textures.sentryPlatform)
    this.platform.anchor.set(0.5)
    this.platform.width = cfg.width
    this.platform.height = cfg.height
    this.cannon = new Sprite(textures.sentryCannon)
    this.cannon.anchor.set(0.5)
    this.cannon.width = cfg.width
    this.cannon.height = cfg.height
    this.view.addChild(this.shield, this.platform, this.cannon, this.hp)
    if (import.meta.env.DEV || import.meta.env.ENV === 'debug') {
      this.view.addChild(new Graphics().circle(0, 0, cfg.radius)
        .stroke({ color: 0xff5555, width: 1, alpha: 0.55 }))
    }
  }

  sync(model: SentryTurret) {
    const cfg = this.config
    this.view.position.set(model.position.x, model.position.y)
    this.view.visible = model.active
    this.shield.visible = model.isShielded
    this.cannon.rotation = model.angle - Math.PI / 2
    if (model.hp !== this.lastHp) {
      this.hp.clear().rect(-cfg.width / 2, -cfg.height / 2 - cfg.hpBar.offset, cfg.width, cfg.hpBar.height).fill(cfg.hpBar.backgroundColor)
        .rect(-cfg.width / 2, -cfg.height / 2 - cfg.hpBar.offset, cfg.width * model.hp / model.maxHp, cfg.hpBar.height).fill(cfg.hpBar.color)
      this.lastHp = model.hp
    }
  }

  destroy() {
    this.view.destroy({ children: true })
  }
}
