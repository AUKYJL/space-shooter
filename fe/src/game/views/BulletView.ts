import { Container, Graphics } from 'pixi.js'

export class BulletView {
  readonly view = new Container()
  private gfx = new Graphics()

  constructor() {
    this.view.addChild(this.gfx)
  }

  draw(radius: number, color: number) {
    this.gfx.clear().circle(0, 0, radius).fill({ color, alpha: 0.9 })
  }
}
