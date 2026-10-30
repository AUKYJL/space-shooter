export const qk = {
  me: () => ['me'] as const,
  currencies: () => ['me', 'currencies'] as const,
  progression: () => ['me', 'progression'] as const,
  loadout: () => ['loadout'] as const,
  runsHistory: () => ['runs', 'history'] as const,
  upgrades: () => ['upgrades'] as const,
  stationsCatalog: () => ['stations', 'catalog'] as const,
  stationsSlots: () => ['stations', 'slots'] as const,
  stationsUnlocks: () => ['stations', 'unlocks'] as const,
} as const
