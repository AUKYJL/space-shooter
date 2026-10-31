import type { WeaponsConfig } from '@/game/core/gameplayConfig'
import type { EventBus, Unsubscribe } from '@/game/core/EventBus'
import type { AsteroidType } from '@/game/entities/Asteroid'
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact'
import type { ShootingSystem } from '@/game/systems/ShootingSystem'
import { haptics } from '@/shared/lib/haptics'

export class ChargeSystem {
  charge = 0

  private events: EventBus<RunBridgeEventMap>
  private shooting: ShootingSystem
  private unsub: Unsubscribe | null = null

  private config: WeaponsConfig['charge']

  constructor(config: WeaponsConfig['charge'], options: { events: EventBus<RunBridgeEventMap>; shooting: ShootingSystem }) {
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
    const add = this.config.gains[type]
    this.charge = Math.min(1, this.charge + add)
  }

  destroy() {
    this.unsub?.()
    this.unsub = null
  }
}
