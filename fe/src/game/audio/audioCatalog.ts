import manifest from './sound-manifest.json'

export type SfxId = keyof typeof manifest
export type SfxCategory = 'gameplay' | 'ui' | 'result'
export type SfxEmitter = (id: SfxId) => void
export const SFX_MANIFEST = manifest
export const MUSIC_CATALOG = {
  'menu-theme': '/music/menu-theme.ogg',
  'gameplay-01': '/music/gameplay-01.ogg',
  'gameplay-02': '/music/gameplay-02.ogg',
  'gameplay-03': '/music/gameplay-03.ogg',
  'result-theme': '/music/result-theme.ogg',
} as const
export type MusicId = keyof typeof MUSIC_CATALOG
export const GAMEPLAY_TRACKS: readonly MusicId[] = ['gameplay-01', 'gameplay-02', 'gameplay-03']

export const AUDIO_CATALOG = {
  sfx: Object.fromEntries(Object.entries(manifest).map(([id, entry]) => [id, entry.src])),
}

type SfxPolicy = { category: SfxCategory; cooldownMs: number; maxVoices: number; group: string }
const overrides: Partial<Record<SfxId, Partial<SfxPolicy>>> = {
  laser_shot_01: { group: 'laser', cooldownMs: 60, maxVoices: 2 },
  laser_shot_02: { group: 'laser', cooldownMs: 60, maxVoices: 2 },
  asteroid_hit: { group: 'hit', cooldownMs: 80, maxVoices: 2 },
  shield_hit: { group: 'hit', cooldownMs: 80, maxVoices: 2 },
  player_hit: { cooldownMs: 80, maxVoices: 2 },
  loot_pickup: { cooldownMs: 100, maxVoices: 2 },
  rare_pickup: { cooldownMs: 100, maxVoices: 2 },
  turret_fire: { cooldownMs: 100, maxVoices: 2 },
  hazard_damage: { cooldownMs: 250 },
  healing: { cooldownMs: 250 },
  player_death: { category: 'result' },
  game_over: { category: 'result' },
  extraction_success: { category: 'result' },
  new_record: { category: 'result' },
  ui_click: { category: 'ui' },
  ui_pause: { category: 'ui' },
  ui_start: { category: 'ui' },
}

export function getSfxPolicy(id: SfxId): SfxPolicy {
  return { category: 'gameplay', cooldownMs: 150, maxVoices: 1, group: id, ...overrides[id] }
}
