import { Assets } from 'pixi.js'
import type { IMediaInstance, Sound, SoundLibrary } from '@pixi/sound'
import { useAudioSettingsStore, type AudioChannel } from '@/shared/store/audioSettingsStore'
import { AUDIO_CATALOG, SFX_MANIFEST, getSfxPolicy, type SfxId, MUSIC_CATALOG, GAMEPLAY_TRACKS, type MusicId } from './audioCatalog'

type Voice = { id: string; channel: AudioChannel; instance?: IMediaInstance; cleanup?: () => void }
type MusicSlot = { element: HTMLAudioElement; id: MusicId | null; attempt: number; pending: boolean }
type PauseReason = 'run' | 'hidden'

export class AudioManager {
  private library: SoundLibrary | null = null
  private initialization?: Promise<void>
  private unlocked = false
  private voices = new Set<Voice>()
  private reasons = new Set<PauseReason>()
  private requestedMusic: MusicId | null = null
  private musicContext: string | null = null
  private musicRunId: string | null = null
  private playlist = false
  private musicFinished = false
  private musicBlocked = false
  private musicEpoch = 0
  private musicSlots: MusicSlot[] = []
  private currentMusic: MusicSlot | null = null
  private failedMusic = new Set<MusicId>()
  private transitioning = false
  private finishMusicTransition: (() => void) | null = null
  private musicGain = 0
  private fadeTimer: ReturnType<typeof setTimeout> | undefined
  private fadeTarget: number | null = null
  private unsubscribe: (() => void) | null = null
  private generation = 0
  private unlockSequence = 0
  private lastPlayed = new Map<string, number>()

  initialize(): Promise<void> {
    this.unsubscribe ??= useAudioSettingsStore.subscribe(() => {
      this.refresh()
      this.resumeRequestedMusic()
    })
    this.initialization ??= import('@pixi/sound').then(({ sound }) => {
      this.library = sound
      // Pause reasons are managed here, rather than competing with blur/focus auto-resume.
      sound.disableAutoPause = true
    }).catch(() => { this.initialization = undefined })
    return this.initialization
  }

  // Called synchronously from a gesture handler: never await initialization before resume().
  unlock(): void {
    this.musicBlocked = false
    this.resumeRequestedMusic()
    if (!this.library) { void this.initialize(); return }
    const generation = this.generation
    const attempt = ++this.unlockSequence
    try {
      const context = this.library.context
      const audioContext = 'audioContext' in context ? context.audioContext as AudioContext : null
      const resumed = audioContext ? audioContext.resume() : Promise.resolve()
      void resumed.then(() => {
        if (generation !== this.generation || attempt !== this.unlockSequence) return
        this.unlocked = !audioContext || audioContext.state === 'running'
        if (this.unlocked) this.resumeRequestedMusic()
      }).catch(() => {
        if (generation === this.generation && attempt === this.unlockSequence) this.unlocked = false
      })
    } catch { this.unlocked = false }
  }

  playSfx(id: SfxId, onComplete?: () => void): void {
    if (!Object.hasOwn(SFX_MANIFEST, id) || !this.unlocked || this.isPaused(id, 'sfx') || !useAudioSettingsStore.getState().settings.sfx.enabled) return
    const policy = getSfxPolicy(id)
    const now = performance.now()
    if (now - (this.lastPlayed.get(policy.group) ?? -Infinity) < policy.cooldownMs) return
    const sfx = [...this.voices].filter((voice) => voice.channel === 'sfx')
    if (sfx.length >= 16 || sfx.filter((voice) => getSfxPolicy(voice.id as SfxId).group === policy.group).length >= policy.maxVoices) return
    // Missing optional assets are dropped immediately, never loaded by playback.
    const resource = Assets.get<Sound>(AUDIO_CATALOG.sfx[id])
    if (!resource?.isLoaded || typeof resource.play !== 'function') { onComplete?.(); return }
    this.lastPlayed.set(policy.group, now)
    void this.startVoice(id, 'sfx', onComplete)
  }

  finishRun(endedBy: 'death' | 'extract'): void {
    this.stopSfx()
    this.playMusic('result-theme')
    this.resume('run')
    if (endedBy === 'extract') this.playSfx('extraction_success')
    else this.playSfx('player_death', () => this.playSfx('game_over'))
  }

  playMusic(id: MusicId): void {
    if (!Object.hasOwn(MUSIC_CATALOG, id)) return
    this.requestMusic(id, id, false)
  }

  startRunMusic(runId: string): void {
    if (this.musicRunId === runId) return
    this.musicRunId = runId
    this.requestMusic(GAMEPLAY_TRACKS[Math.floor(Math.random() * GAMEPLAY_TRACKS.length)], `run:${runId}`, true)
  }

  stopMusic(): void { this.requestMusic(null, null, false) }

  stopSfx(): void {
    this.lastPlayed.clear()
    for (const voice of this.voices) this.stopVoice(voice)
  }

  stopAll(): void {
    this.stopSfx()
    this.musicEpoch++
    this.cancelFade()
    this.requestedMusic = null
    this.musicContext = null
    this.musicRunId = null
    this.transitioning = false
    this.finishMusicTransition = null
    for (const slot of this.musicSlots) this.releaseMusicSlot(slot)
    this.currentMusic = null
  }

  setEnabled(channel: AudioChannel, enabled: boolean): void {
    useAudioSettingsStore.getState().setEnabled(channel, enabled)
  }

  setVolume(channel: AudioChannel, volume: number): void {
    useAudioSettingsStore.getState().setVolume(channel, volume)
  }

  pause(reason: PauseReason): void { this.reasons.add(reason); this.refresh(); this.resumeRequestedMusic() }
  resume(reason: PauseReason): void {
    this.reasons.delete(reason)
    this.refresh()
    this.resumeRequestedMusic()
  }

  dispose(): void {
    this.generation++
    this.stopAll()
    for (const slot of this.musicSlots) this.releaseMusicSlot(slot)
    this.musicSlots = []
    this.reasons.clear()
    this.unlocked = false
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  private requestMusic(id: MusicId | null, context: string | null, playlist: boolean): void {
    if (context === this.musicContext) return
    this.musicEpoch++
    this.cancelFade()
    this.requestedMusic = id
    this.musicContext = context
    this.playlist = playlist
    this.musicFinished = false
    this.musicBlocked = false
    this.failedMusic.clear()
    this.transitioning = true
    // Old source callbacks must not change the new context during its fade-out.
    for (const slot of this.musicSlots) {
      slot.element.onended = null
      slot.element.onerror = null
    }
    const activate = () => {
      if (this.currentMusic) this.pauseMusicSlot(this.currentMusic)
      this.currentMusic = null
      this.transitioning = false
      this.finishMusicTransition = null
      this.activateMusic()
      for (const slot of this.musicSlots) {
        if (slot !== this.currentMusic && (!playlist || !id || slot.id !== this.nextMusic(id))) this.releaseMusicSlot(slot)
      }
    }
    this.finishMusicTransition = activate
    if (this.currentMusic && !this.currentMusic.element.paused && !this.reasons.has('hidden')) this.fadeMusic(0, activate)
    else activate()
  }

  private activateMusic(): void {
    const id = this.requestedMusic
    if (!id || this.musicFinished || this.failedMusic.has(id)) return
    if (!this.musicSlots.length) {
      this.musicSlots = Array.from({ length: 2 }, () => ({ element: new Audio(), id: null, attempt: 0, pending: false }))
    }
    const slot = this.musicSlots.find((item) => item.id === id) ?? this.musicSlots[0]
    this.currentMusic = slot
    this.musicGain = 0
    this.prepareMusic(slot, id)
    slot.element.currentTime = 0
    slot.element.loop = id === 'menu-theme'
    const epoch = this.musicEpoch
    slot.element.onended = () => {
      if (epoch !== this.musicEpoch || slot !== this.currentMusic || this.transitioning) return
      this.cancelFade()
      this.pauseMusicSlot(slot)
      const next = this.playlist ? this.nextMusic(id) : null
      if (!next) { this.musicFinished = true; return }
      this.requestedMusic = next
      this.activateMusic()
    }
    this.resumeRequestedMusic()
  }

  private prepareMusic(slot: MusicSlot, id: MusicId): void {
    const epoch = this.musicEpoch
    slot.element.onerror = () => {
      if (epoch === this.musicEpoch && slot.id === id) this.musicError(slot, id)
    }
    if (slot.id === id) return
    this.pauseMusicSlot(slot)
    slot.id = id
    slot.element.preload = 'auto'
    slot.element.src = MUSIC_CATALOG[id]
    slot.element.load()
  }

  private nextMusic(id: MusicId): MusicId | null {
    const index = GAMEPLAY_TRACKS.indexOf(id)
    for (let offset = 1; offset < GAMEPLAY_TRACKS.length; offset++) {
      const next = GAMEPLAY_TRACKS[(index + offset) % GAMEPLAY_TRACKS.length]
      if (!this.failedMusic.has(next)) return next
    }
    return null
  }

  private prepareNextMusic(): void {
    if (!this.playlist || !this.currentMusic?.id) return
    const next = this.nextMusic(this.currentMusic.id)
    const spare = this.musicSlots.find((slot) => slot !== this.currentMusic)
    if (next && spare) this.prepareMusic(spare, next)
  }

  private musicError(slot: MusicSlot, id: MusicId): void {
    this.failedMusic.add(id)
    this.pauseMusicSlot(slot)
    slot.id = null
    if (slot !== this.currentMusic) { this.prepareNextMusic(); return }
    this.cancelFade()
    const next = this.playlist ? this.nextMusic(id) : null
    if (!next) { this.musicFinished = true; return }
    this.requestedMusic = next
    this.activateMusic()
  }

  private releaseMusicSlot(slot: MusicSlot): void {
    this.pauseMusicSlot(slot)
    slot.element.onended = null
    slot.element.onerror = null
    if (slot.id || slot.element.src) {
      slot.id = null
      slot.element.removeAttribute('src')
      slot.element.load()
    }
  }

  private pauseMusicSlot(slot: MusicSlot): void {
    slot.attempt++
    slot.pending = false
    slot.element.pause()
  }

  private resumeRequestedMusic(): void {
    if (this.transitioning) {
      this.updateMusicVolume()
      if (this.reasons.has('hidden') || !useAudioSettingsStore.getState().settings.music.enabled) {
        this.cancelFade()
        this.finishMusicTransition?.()
      }
      return
    }
    if (!this.currentMusic || this.musicFinished) return
    const slot = this.currentMusic
    const settings = useAudioSettingsStore.getState().settings.music
    if (this.reasons.has('hidden') || !settings.enabled) {
      this.cancelFade()
      this.pauseMusicSlot(slot)
      this.musicGain = 0
      this.updateMusicVolume()
      return
    }
    this.updateMusicVolume()
    if (this.reasons.has('run')) {
      if (!slot.element.paused && this.fadeTarget !== 0) this.fadeMusic(0, () => this.pauseMusicSlot(slot))
      return
    }
    if (slot.pending || this.musicBlocked) return
    if (!slot.element.paused) {
      if (this.fadeTarget === 0) this.fadeMusic(1)
      return
    }
    const epoch = this.musicEpoch
    const attempt = ++slot.attempt
    slot.pending = true
    const failed = (error: unknown) => {
      if (epoch !== this.musicEpoch || attempt !== slot.attempt) return
      slot.pending = false
      const name = error && typeof error === 'object' && 'name' in error ? error.name : ''
      if (name === 'NotAllowedError') this.musicBlocked = true
      else if (name !== 'AbortError' && slot.id) this.musicError(slot, slot.id)
    }
    try {
      // Must run in the gesture call stack; WebAudio unlock is independent.
      void slot.element.play().then(() => {
        if (epoch !== this.musicEpoch || attempt !== slot.attempt) return
        slot.pending = false
        if (this.reasons.size || !useAudioSettingsStore.getState().settings.music.enabled) {
          this.resumeRequestedMusic()
          return
        }
        this.fadeMusic(1)
        this.prepareNextMusic()
      }).catch(failed)
    } catch (error) { failed(error) }
  }

  private updateMusicVolume(): void {
    if (this.currentMusic) this.currentMusic.element.volume = this.musicGain * useAudioSettingsStore.getState().settings.music.volume
  }

  private cancelFade(): void {
    clearTimeout(this.fadeTimer)
    this.fadeTimer = undefined
    this.fadeTarget = null
  }

  private fadeMusic(target: number, complete?: () => void): void {
    this.cancelFade()
    this.fadeTarget = target
    const from = this.musicGain
    let elapsed = 0
    const tick = () => {
      elapsed = Math.min(300, elapsed + 15)
      this.musicGain = from + (target - from) * elapsed / 300
      this.updateMusicVolume()
      if (elapsed < 300) this.fadeTimer = setTimeout(tick, 15)
      else { this.fadeTarget = null; this.fadeTimer = undefined; complete?.() }
    }
    this.fadeTimer = setTimeout(tick, 15)
  }

  private isPaused(id: string, channel: AudioChannel): boolean {
    return this.reasons.has('hidden') || (this.reasons.has('run')
      && (channel === 'music' || getSfxPolicy(id as SfxId).category === 'gameplay'))
  }

  private async startVoice(id: string, channel: AudioChannel, onComplete?: () => void): Promise<void> {
    const voice: Voice = { id, channel }
    this.voices.add(voice)
    try {
      if (!this.voices.has(voice)) return
      const settings = useAudioSettingsStore.getState().settings[channel]
      if (!this.unlocked || this.isPaused(id, channel) || !settings.enabled) {
        this.voices.delete(voice)
        return
      }
      const resource = Assets.get<Sound>(AUDIO_CATALOG.sfx[id])
      if (!resource) { this.voices.delete(voice); return }
      const instance = await resource.play({ loop: false, volume: this.volume(id, channel),
        muted: !settings.enabled })
      if (!this.voices.has(voice)) { instance.stop(); return }
      voice.instance = instance
      const release = () => {
        voice.cleanup?.()
        this.voices.delete(voice)
      }
      const complete = () => { release(); onComplete?.() }
      voice.cleanup = () => { instance.off('end', complete); instance.off('stop', release) }
      instance.once('end', complete)
      instance.once('stop', release)
      this.refresh()
    } catch { if (this.voices.delete(voice)) onComplete?.() }
  }

  private volume(id: string, channel: AudioChannel): number {
    return useAudioSettingsStore.getState().settings[channel].volume
      * (channel === 'sfx' ? SFX_MANIFEST[id as SfxId].volume : 1)
  }

  private stopVoice(voice: Voice): void {
    this.voices.delete(voice)
    voice.cleanup?.()
    try { voice.instance?.stop() } catch { /* Playback failures never reach gameplay. */ }
  }

  private refresh(): void {
    const settings = useAudioSettingsStore.getState().settings
    for (const voice of this.voices) {
      if (!voice.instance) continue
      try {
        voice.instance.volume = this.volume(voice.id, voice.channel)
        voice.instance.muted = !settings[voice.channel].enabled
        voice.instance.paused = this.isPaused(voice.id, voice.channel)
      } catch { this.stopVoice(voice) }
    }
  }
}

export const audioManager = new AudioManager()

export function bindAudioLifecycle(): () => void {
  void audioManager.initialize()
  const unlock = () => audioManager.unlock()
  const visibility = () => document.hidden ? audioManager.pause('hidden') : audioManager.resume('hidden')
  document.addEventListener('pointerdown', unlock, true)
  document.addEventListener('touchend', unlock, true)
  document.addEventListener('keydown', unlock, true)
  document.addEventListener('visibilitychange', visibility)
  visibility()
  return () => {
    document.removeEventListener('pointerdown', unlock, true)
    document.removeEventListener('touchend', unlock, true)
    document.removeEventListener('keydown', unlock, true)
    document.removeEventListener('visibilitychange', visibility)
    audioManager.dispose()
  }
}
