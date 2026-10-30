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

  constructor(options: { events: EventBus<RunBridgeEventMap>; shooting: ShootingSystem }) {
    this.events = options.events
    this.shooting = options.shooting
  }

  mount() {
    this.unsub = this.events.on('charge:activate', () => {
      if (this.charge <= 0.02) return
      this.shooting.fireChargedShot()
      haptics.chargeShot()
      this.charge = 0
    })
  }

  onAsteroidDestroyed(type: AsteroidType) {
    const add = type === 'armored' ? 0.22 : type === 'big' ? 0.16 : type === 'fast' ? 0.08 : 0.1
    this.charge = Math.min(1, this.charge + add)
  }

  destroy() {
    this.unsub?.()
    this.unsub = null
  }
}
