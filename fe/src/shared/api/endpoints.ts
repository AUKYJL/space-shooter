export const endpoints = {
  health: () => '/health',
  auth: {
    loginDev: () => '/auth/login-dev',
  },
  me: () => '/me',
  meCurrencies: () => '/me/currencies',
  meProgression: () => '/me/progression',
  loadout: () => '/loadout',
  loadoutWeapon: () => '/loadout/weapon',
  runs: {
    start: () => '/runs/start',
    finish: () => '/runs/finish',
    history: () => '/runs/history',
  },
  upgrades: () => '/upgrades',
  upgradesBuy: () => '/upgrades/buy',
  stations: {
    catalog: () => '/stations/catalog',
    unlocks: () => '/stations/unlocks',
    slots: () => '/stations/slots',
    unlockSlot: () => '/stations/unlock-slot',
    unlock: () => '/stations/unlock',
    assign: (slotId: string) => `/stations/slots/${encodeURIComponent(slotId)}/assign`,
    start: (slotId: string) => `/stations/slots/${encodeURIComponent(slotId)}/start`,
    collect: (slotId: string) => `/stations/slots/${encodeURIComponent(slotId)}/collect`,
  },
} as const
