import { Container, Graphics } from 'pixi.js'
import type { SentryTurret } from '@/game/entities/SentryTurret'
import type { SentryTurretConfig, ShieldDroneConfig } from '@/game/core/enemyConfig'

export class SentryTurretView {
  readonly view = new Container()
  readonly shield = new Graphics()
  private platform = new Graphics()
  private cannon = new Graphics()
  private hp = new Graphics()
  private lastState = ''
  private lastHp = -1

  private config: SentryTurretConfig

  constructor(cfg: SentryTurretConfig, shieldCfg: ShieldDroneConfig) {
    this.config = cfg
    this.shield.circle(0, 0, shieldCfg.shieldRadius)
      .stroke({ width: shieldCfg.shieldWidth, color: shieldCfg.color, alpha: shieldCfg.shieldAlpha })
    this.shield.visible = false
    this.cannon.circle(0, 0, cfg.cannonRadius).fill(cfg.cannonColor)
      .rect(0, -cfg.barrelWidth / 2, cfg.barrelLength, cfg.barrelWidth).fill(cfg.cannonColor)
    this.view.addChild(this.shield, this.platform, this.cannon, this.hp)
  }

  sync(model: SentryTurret) {
    const cfg = this.config
    this.view.position.set(model.position.x, model.position.y)
    this.view.visible = model.active
    this.shield.visible = model.isShielded
    this.cannon.rotation = model.angle
    if (model.state !== this.lastState) {
      const color = model.state === 'active' ? cfg.activeColor : model.state === 'entering' ? cfg.enteringColor : cfg.leavingColor
      this.platform.clear().rect(-cfg.width / 2, -cfg.height / 2, cfg.width, cfg.height)
        .fill(color).stroke({ width: cfg.outlineWidth, color: cfg.outlineColor })
      this.lastState = model.state
    }
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
