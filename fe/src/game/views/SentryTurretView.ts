import { Container, Graphics } from 'pixi.js'
import type { SentryTurret } from '@/game/entities/SentryTurret'
import { SENTRY_TURRET_CONFIG as cfg } from '@/game/entities/sentryTurretConfig'

export class SentryTurretView {
  readonly view = new Container()
  private platform = new Graphics()
  private cannon = new Graphics()
  private hp = new Graphics()
  private lastState = ''
  private lastHp = -1

  constructor() {
    this.cannon.circle(0, 0, cfg.cannonRadius).fill(0xddeeff)
      .rect(0, -cfg.barrelWidth / 2, cfg.barrelLength, cfg.barrelWidth).fill(0xddeeff)
    this.view.addChild(this.platform, this.cannon, this.hp)
  }

  sync(model: SentryTurret) {
    this.view.position.set(model.position.x, model.position.y)
    this.view.visible = model.active
    this.cannon.rotation = model.angle
    if (model.state !== this.lastState) {
      const color = model.state === 'active' ? 0xff6655 : model.state === 'entering' ? 0xffc857 : 0x7b8aab
      this.platform.clear().rect(-cfg.width / 2, -cfg.height / 2, cfg.width, cfg.height)
        .fill(color).stroke({ width: 2, color: 0xeeeeff })
      this.lastState = model.state
    }
    if (model.hp !== this.lastHp) {
      this.hp.clear().rect(-cfg.width / 2, -cfg.height / 2 - 9, cfg.width, 4).fill(0x222233)
        .rect(-cfg.width / 2, -cfg.height / 2 - 9, cfg.width * model.hp / model.maxHp, 4).fill(0x66ff99)
      this.lastHp = model.hp
    }
  }

  destroy() {
    this.view.destroy({ children: true })
  }
}
