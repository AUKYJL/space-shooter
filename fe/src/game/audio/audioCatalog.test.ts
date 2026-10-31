/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUDIO_CATALOG, SFX_MANIFEST, MUSIC_CATALOG } from './audioCatalog'

describe('pack manifest', () => {
  it('resolves all 32 IDs to actual OGG files with valid initial volumes', () => {
    expect(Object.keys(SFX_MANIFEST)).toHaveLength(32)
    for (const [id, { src, volume }] of Object.entries(SFX_MANIFEST)) {
      expect(AUDIO_CATALOG.sfx[id]).toBe(src)
      expect(src).toMatch(/^\/sfx\/[a-z-]+\/[a-z0-9-]+\.ogg$/)
      expect(readFileSync(resolve('public', src.slice(1))).subarray(0, 4).toString()).toBe('OggS')
      expect(volume).toBeGreaterThan(0)
      expect(volume).toBeLessThanOrEqual(1)
    }
  })
})

it('resolves exactly five music tracks to OGG files', () => {
  expect(Object.keys(MUSIC_CATALOG)).toHaveLength(5)
  for (const src of Object.values(MUSIC_CATALOG)) {
    expect(readFileSync(resolve('public', src.slice(1))).subarray(0, 4).toString()).toBe('OggS')
  }
})
