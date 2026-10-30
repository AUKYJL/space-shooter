import { Container, Sprite, Texture } from 'pixi.js'

export class ExtractionBase {
  view: Container
  radius = 26
  active = false

  private sprite?: Sprite
  private texture?: Texture
  private baseScale = 1
  private animTimeMs = 0

  constructor(options?: { texture?: Texture }) {
    this.view = new Container()
    this.texture = options?.texture

    if (this.texture) {
      this.sprite = new Sprite(this.texture)
      this.sprite.anchor.set(0.5)
      this.view.addChild(this.sprite)
      this.scaleToRadius()
    }

    this.view.visible = false
  }

  spawn(options: { x: number; y: number }) {
    this.active = true
    this.animTimeMs = 0
    this.view.position.set(options.x, options.y)
    this.view.visible = true
  }

  despawn() {
    this.active = false
    this.view.visible = false
    this.view.rotation = 0
  }

  destroy() {
    this.view.destroy({ children: true })
  }

  update(dtMs: number) {
    if (!this.active) return
    if (!this.sprite) return

    this.animTimeMs += dtMs

    const rotationRadPerMs = 0.0005
    this.view.rotation += rotationRadPerMs * dtMs

    const pulseAmp = 0.04
    const pulsePeriodMs = 1400
    const pulse01 = Math.sin((this.animTimeMs / pulsePeriodMs) * Math.PI * 2)
    const scale = this.baseScale * (1 + pulseAmp * pulse01)
    this.sprite.scale.set(scale)
  }

  private scaleToRadius() {
    if (!this.sprite) return
    const baseHeight = this.sprite.height || 1
    const target = this.radius * 2
    this.baseScale = target / baseHeight
    this.sprite.scale.set(this.baseScale)
  }
}
