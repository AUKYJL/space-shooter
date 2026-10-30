import type { EventBus } from '@/game/core/EventBus'
import type { RunBridgeEventMap } from '@/game/ui-bridge/gameToReact'

export function emitChargeActivate(bus: EventBus<RunBridgeEventMap>) {
  bus.emit('charge:activate', undefined)
}

export function emitRunPause(bus: EventBus<RunBridgeEventMap>) {
  bus.emit('run:pause', undefined)
}

export function emitRunResume(bus: EventBus<RunBridgeEventMap>) {
  bus.emit('run:resume', undefined)
}

export function emitRunInit(
  bus: EventBus<RunBridgeEventMap>,
  payload: { runId: string; seed: number; snapshot: { weaponId: string; damage: number; fireRate: number; maxHp: number } },
) {
  bus.emit('run:init', payload)
}
