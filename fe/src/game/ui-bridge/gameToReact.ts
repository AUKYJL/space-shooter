import type { EventBus, Unsubscribe } from '@/game/core/EventBus'

export type RunHudState = {
  score: number
  stage: number
  hp: number
  maxHp: number
  charge: number
  multiplier: number
  coins: number
  iron: number
  gold: number
  crystal: number
  extractionAvailable: boolean
  extractionInZone: boolean
  extractionBaseTtlMs: number
  extractionProgressMs: number
  extractionRequiredMs: number
}

export type RunEndedBy = 'death' | 'extract'

export type RunSummary = {
  score: number
  stageReached: number
  durationMs: number
  endedBy: RunEndedBy
  extractionCount: number
  multiplier: number
  collected: {
    coins: number
    iron: number
    gold: number
    crystal: number
  }
  banked: {
    coins: number
    iron: number
    gold: number
    crystal: number
  }
  destroyed: {
    normal: number
    fast: number
    big: number
    armored: number
  }
}

export type RunBridgeEventMap = {
  'run:init': { runId: string; seed: number; snapshot: { weaponId: string; damage: number; fireRate: number; maxHp: number } }
  'run:hud-update': RunHudState
  'charge:activate': undefined
  'run:pause': undefined
  'run:resume': undefined
  'run:finished': RunSummary
}

export function onRunHudUpdate(bus: EventBus<RunBridgeEventMap>, handler: (state: RunHudState) => void): Unsubscribe {
  return bus.on('run:hud-update', handler)
}

export function onRunFinished(bus: EventBus<RunBridgeEventMap>, handler: (payload: RunSummary) => void): Unsubscribe {
  return bus.on('run:finished', handler)
}
