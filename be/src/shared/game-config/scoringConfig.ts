import { SENTRY_TURRET_CONFIG, type SentryTurretConfig } from "./enemies/sentryTurretConfig";
import { SHIELD_DRONE_CONFIG, type ShieldDroneConfig } from "./enemies/shieldDroneConfig";
import { MINE_LAYER_CONFIG, type MineLayerConfig } from "./enemies/mineLayerConfig";

export const SCORING_CONFIG = Object.freeze({
  asteroidPoints: Object.freeze({ normal: 10, fast: 20, big: 30, armored: 50 }),
  stageBonus: 100,
  enemyPoints: Object.freeze({ sentryTurret: 100, shieldDrone: 50, mineLayer: 150 }),
  enemies: Object.freeze({ sentryTurret: SENTRY_TURRET_CONFIG, shieldDrone: SHIELD_DRONE_CONFIG, mineLayer: MINE_LAYER_CONFIG }),
});

type EnemyConfigs = Readonly<{ sentryTurret: SentryTurretConfig; shieldDrone: ShieldDroneConfig; mineLayer: MineLayerConfig }>;

export type ScoringConfig = {
  enemies: EnemyConfigs;
  asteroidPoints: { normal: number; fast: number; big: number; armored: number };
  stageBonus: number;
  enemyPoints: { sentryTurret: number; shieldDrone: number; mineLayer: number };
};

