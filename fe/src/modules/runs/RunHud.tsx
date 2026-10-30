import { ChargeButton } from '@/modules/runs/ui/ChargeButton'
import { formatSignedInt } from '@/shared/lib/formatSignedInt'
import { Button } from '@/shared/ui/button'
import { ResourceIcon } from '@/shared/ui/ResourceIcon'

export type RunHudModel = {
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

export function RunHud(props: {
  model: RunHudModel
  onCharge: () => void
  onPause: () => void
  pauseDisabled?: boolean
}) {
  const hpPct = props.model.maxHp > 0 ? (props.model.hp / props.model.maxHp) * 100 : 0
  const charge01 = Math.max(0, Math.min(1, props.model.charge))
  const coinsText = formatSignedInt(props.model.coins)
  const extraction01 =
    props.model.extractionRequiredMs > 0 ? Math.max(0, Math.min(1, props.model.extractionProgressMs / props.model.extractionRequiredMs)) : 0
  const ttlSeconds = Math.ceil(Math.max(0, props.model.extractionBaseTtlMs) / 1000)

  return (
    <>
      <div className="pointer-events-none absolute left-0 top-0 right-0 z-10 px-4 pt-[calc(16px+env(safe-area-inset-top))]">
        <div className="grid grid-cols-3 items-start">
          <div className="justify-self-start">
            <div className="flex items-center gap-2">
              <Button
                size="icon-xs"
                variant="outline"
                aria-label="Pause"
                disabled={props.pauseDisabled}
                className="pointer-events-auto"
                onClick={props.onPause}
              >
                II
              </Button>
              <div>
                <div className="text-[10px] font-medium tracking-wide text-white/70">HP</div>
                <div className="mt-2 relative h-4 w-28 overflow-hidden rounded-full bg-white/12">
                  <div className="absolute inset-y-0 left-0 bg-neon-cyan" style={{ width: `${hpPct}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-white/90">
                    {props.model.hp}/{props.model.maxHp}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="justify-self-center text-center">
            <div className="text-sm font-bold tabular-nums text-white">Score {props.model.score.toLocaleString()}</div>
            <div className="text-[10px] font-semibold tracking-[0.22em] text-neon-cyan/90">
              STAGE {props.model.stage}
            </div>
            <div className="mt-1 text-[10px] text-white/65">{props.model.multiplier.toFixed(1)}x Multiplier</div>
          </div>

          <div className="justify-self-end text-right">
            <div className="flex items-center justify-end gap-1 text-[10px] font-medium tracking-wide text-white/70">
              <ResourceIcon id="coins" size={12} />
              <span>Run Coins</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-accent-gold">{coinsText}</div>
          </div>
        </div>

        {props.model.extractionAvailable ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur">
            <div className="flex items-center justify-between text-[10px] font-medium tracking-wide text-white/70">
              <div>{props.model.extractionInZone ? 'EXTRACTING…' : 'EXTRACTION BASE'}</div>
              <div className="tabular-nums">{ttlSeconds}s</div>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full bg-neon-cyan transition-[width] duration-100 ease-linear"
                style={{ width: `${extraction01 * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-auto absolute left-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-10">
        <ChargeButton charge01={charge01} onClick={props.onCharge} />
      </div>
    </>
  )
}
