import { useId } from 'react'
import { useAudioSettingsStore } from '@/shared/store/audioSettingsStore'

export function AudioSettings() {
  const id = useId()
  const { settings, setEnabled, setVolume } = useAudioSettingsStore()
  return (
    <fieldset className="space-y-3 rounded-xl bg-bg-secondary p-3 text-sm">
      <legend className="px-1 text-xs text-text-secondary">Audio</legend>
      {(['music', 'sfx'] as const).map((channel) => {
        const label = channel === 'music' ? 'Music' : 'SFX'
        const value = settings[channel]
        return <div key={channel} className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!value.enabled} onChange={(event) => setEnabled(channel, !event.target.checked)} />
            {label} Mute
          </label>
          <label className="flex items-center gap-3" htmlFor={`${id}-${channel}`}>
            <span>{label} Volume</span>
            <input id={`${id}-${channel}`} className="min-w-0 flex-1 accent-cyan-400" type="range" aria-label={`${label} Volume`} min={0} max={100}
              value={Math.round(value.volume * 100)}
              onChange={(event) => setVolume(channel, Number(event.target.value) / 100)} />
            <output htmlFor={`${id}-${channel}`}>{Math.round(value.volume * 100)}%</output>
          </label>
        </div>
      })}
    </fieldset>
  )
}
