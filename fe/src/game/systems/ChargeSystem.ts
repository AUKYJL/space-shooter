import type { SfxEmitter } from '@/game/audio/audioCatalog'
import type { WeaponsConfig } from '@/game/core/gameplayConfig'
import type { EventBus, Unsubscribe } from '@/game/core/EventBus'
import type { AsteroidType } from '@/game/entities/Asteroid'
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact'
import type { ShootingSystem } from '@/game/systems/ShootingSystem'
import { haptics } from '@/shared/lib/haptics'

export class ChargeSystem {
  private onSfx?: SfxEmitter
  charge = 0

  private events: EventBus<RunBridgeEventMap>
  private shooting: ShootingSystem
  private unsub: Unsubscribe | null = null

  private config: WeaponsConfig['charge']

  constructor(config: WeaponsConfig['charge'], options: { onSfx?: SfxEmitter; events: EventBus<RunBridgeEventMap>; shooting: ShootingSystem }) {
    this.onSfx = options.onSfx
    this.config = config
    this.events = options.events
    this.shooting = options.shooting
  }

  mount() {
    this.unsub = this.events.on('charge:activate', () => {
      if (this.charge <= this.config.activationThreshold) return
      this.shooting.fireChargedShot()
      haptics.chargeShot()
      this.charge = 0
    })
  }

  onAsteroidDestroyed(type: AsteroidType) {
    const previous = this.charge
    const add = this.config.gains[type]
    this.charge = Math.min(1, this.charge + add)
    if (previous <= this.config.activationThreshold && this.charge > this.config.activationThreshold) this.onSfx?.('charge_ready')
    else if (previous === 0 && this.charge > 0) this.onSfx?.('charge_up')
  }

  destroy() {
    this.unsub?.()
    this.unsub = null
  }
}
