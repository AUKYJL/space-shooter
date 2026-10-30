import { Button } from '@/shared/ui/button'
import { ResourceIcon } from '@/shared/ui/ResourceIcon'

export type ExtractionDialogModel = {
  open: boolean
  multiplier: number
  extractionCount: number
  collected: {
    coins: number
    iron: number
    gold: number
    crystal: number
  }
}

export function ExtractionDialog(props: {
  model: ExtractionDialogModel
  onContinue: () => void
  onExtract: () => void
}) {
  const { model } = props
  if (!model.open) return null

  const bankedCoins = Math.round(model.collected.coins * model.multiplier)
  const bankedIron = Math.round(model.collected.iron * model.multiplier)
  const bankedGold = Math.round(model.collected.gold * model.multiplier)
  const bankedCrystal = Math.round(model.collected.crystal * model.multiplier)

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 p-4">
      <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-bg-primary p-4 shadow-xl">
        <div className="text-sm font-semibold">Extraction Point</div>
        <div className="mt-1 text-xs text-text-secondary">
          Extract now to bank your loot, or continue to increase multiplier.
        </div>

        <div className="mt-3 rounded-xl bg-bg-secondary px-4 py-3">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Extractions</span>
            <span className="font-semibold text-white">{model.extractionCount}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-text-secondary">
            <span>Multiplier</span>
            <span className="font-semibold text-neon-cyan">x{model.multiplier.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-bg-secondary px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-text-secondary">
              <ResourceIcon id="coins" size={12} />
              <span>Coins</span>
            </div>
            <div className="text-sm font-semibold text-accent-gold">{bankedCoins.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-bg-secondary px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-text-secondary">
              <ResourceIcon id="iron" size={12} />
              <span>Iron</span>
            </div>
            <div className="text-sm font-semibold text-white">{bankedIron.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-bg-secondary px-3 py-2">
            <div className="text-[11px] text-text-secondary">Gold</div>
            <div className="text-sm font-semibold text-accent-gold">{bankedGold.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-bg-secondary px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-text-secondary">
              <ResourceIcon id="crystals" size={12} />
              <span>Crystal</span>
            </div>
            <div className="text-sm font-semibold text-neon-cyan">{bankedCrystal.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="xl" className="h-12" onClick={props.onContinue}>
            Continue
          </Button>
          <Button size="xl" className="h-12" onClick={props.onExtract}>
            Extract
          </Button>
        </div>
      </div>
    </div>
  )
}
