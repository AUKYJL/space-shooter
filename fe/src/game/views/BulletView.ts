import { Container, Graphics, Sprite, type Texture } from 'pixi.js'

export class BulletView {
  readonly view = new Container()
  private body: Graphics | Sprite

  constructor(texture?: Texture) {
    if (texture) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.alpha = 0.9
      this.body = sprite
    } else {
      this.body = new Graphics()
    }
    this.view.addChild(this.body)
  }

  draw(radius: number, color: number) {
    if (this.body instanceof Sprite) {
      this.body.width = this.body.height = radius * 2
    } else {
      this.body.clear().circle(0, 0, radius).fill({ color, alpha: 0.9 })
    }
  }
}
