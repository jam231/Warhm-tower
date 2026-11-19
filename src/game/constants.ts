import type { BiomeId, BiomeTheme, ComboRank } from './types';

/** Fixed logical tower dimensions (identical physics across phone, iPad, laptop) */
export const WORLD_WIDTH = 480;
export const BASE_VIEW_HEIGHT = 720;
export const WALL_WIDTH = 34;
export const SHAFT_LEFT = WALL_WIDTH;
export const SHAFT_RIGHT = WORLD_WIDTH - WALL_WIDTH;
export const SHAFT_WIDTH = SHAFT_RIGHT - SHAFT_LEFT; // 412px

/** Fixed 60Hz physics step for identical gameplay on 60Hz/90Hz/120Hz/144Hz displays */
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.05;

/** Platform geometry */
export const FLOOR_SPACING = 88;
export const PLATFORM_HEIGHT = 18;
export const MILESTONE_INTERVAL = 10;

/** Space Marine hitbox (compact feet for fair landings) */
export const PLAYER_WIDTH = 32;
export const PLAYER_HEIGHT = 48;

/** Icy Tower-faithful physics constants */
export const GRAVITY = 1950;
export const MAX_FALL_SPEED = 1120;

export const GROUND_ACCEL = 2250;
export const GROUND_TURN_ACCEL = 3400;
export const GROUND_FRICTION = 1500;
export const AIR_ACCEL = 1650;
export const AIR_DRAG = 140;

export const MAX_RUN_SPEED = 445;
export const MAX_AIR_SPEED = 540;

/** Jump tuning: standing jump clears 1 floor cleanly; full-speed jump clears 3+ floors */
export const BASE_JUMP_VY = -665;
export const SPEED_JUMP_RATIO = 0.86;
export const SPIN_SPEED_THRESHOLD = 265;
export const VARIABLE_JUMP_CUT = 0.56;

/** Wall bounce tuning */
export const WALL_BOUNCE_MIN_SPEED = 145;
export const WALL_BOUNCE_RETENTION = 0.96;
export const WALL_BOUNCE_BOOST_VX = 42;
export const WALL_BOUNCE_LIFT_VY = -72;

/** Forgiveness windows (seconds) */
export const COYOTE_TIME = 0.095;
export const JUMP_BUFFER_TIME = 0.115;

/** Combo system tuning */
export const COMBO_DURATION = 3.2;
export const COMBO_MIN_FLOORS_TO_SCORE = 4;

/** Rising scroll & "HURRY UP!" escalation */
export const SCROLL_START_FLOOR = 5;
export const HURRY_INTERVAL_SECONDS = 26;
export const MAX_HURRY_LEVEL = 6;
export const HURRY_SCROLL_SPEEDS = [0, 58, 92, 128, 168, 212, 260];

export const HURRY_CALLOUTS: readonly string[] = [
  '',
  'THE WARP RISES!',
  'PURGE ACCELERATES!',
  'HURRY, BROTHER!',
  'EXTERMINATUS SPEED!',
  'NO MERCY! CLIMB!',
  'FOR THE EMPEROR!',
];

export const COMBO_RANKS: readonly ComboRank[] = [
  { minFloors: 50, title: 'FOR THE EMPEROR!', color: '#ffe680' },
  { minFloors: 35, title: 'CODEX PERFECT!', color: '#f5c749' },
  { minFloors: 25, title: 'WRATH OF ULTRAMAR!', color: '#ff9642' },
  { minFloors: 15, title: 'GLORIOUS!', color: '#64d2ff' },
  { minFloors: 7, title: 'FOR MACRAGGE!', color: '#70b7ff' },
  { minFloors: 4, title: 'WORTHY!', color: '#dce6f5' },
];

export const BIOMES: readonly BiomeTheme[] = [
  {
    id: 'underhive',
    name: 'UNDERHIVE SPIRE',
    subtitle: 'Ferrocrete Foundations',
    minFloor: 0,
    frictionMultiplier: 1.0,
    skyTop: '#0a0e17',
    skyBottom: '#181e2c',
    archColor: '#131926',
    archHighlight: '#242f44',
    wallBase: '#212733',
    wallTrim: '#5d687d',
    platformTop: '#7b879c',
    platformBody: '#384152',
    platformBorder: '#161b24',
    platformAccent: '#d6a437',
    ambientEmber: '#ff8a3d',
  },
  {
    id: 'ecclesiarchy',
    name: 'ECCLESIARCHY NAVE',
    subtitle: 'Sanctified Marble Vaults',
    minFloor: 50,
    frictionMultiplier: 0.84,
    skyTop: '#12101a',
    skyBottom: '#251c24',
    archColor: '#1c1721',
    archHighlight: '#3d303c',
    wallBase: '#2d262b',
    wallTrim: '#9e824c',
    platformTop: '#cfc6b4',
    platformBody: '#7a7060',
    platformBorder: '#241f1a',
    platformAccent: '#e2b548',
    ambientEmber: '#f3c76b',
  },
  {
    id: 'mechanicus',
    name: 'FORGE MANUFACTRUM',
    subtitle: 'Adeptus Mechanicus Foundry',
    minFloor: 100,
    frictionMultiplier: 0.92,
    skyTop: '#160b0a',
    skyBottom: '#2d1512',
    archColor: '#22100e',
    archHighlight: '#47211a',
    wallBase: '#2f1c18',
    wallTrim: '#b8683a',
    platformTop: '#b97b4c',
    platformBody: '#5b3324',
    platformBorder: '#1e0f0c',
    platformAccent: '#48d6ff',
    ambientEmber: '#ff642e',
  },
  {
    id: 'fortress',
    name: 'FORTRESS OF HERA',
    subtitle: 'Ultramarines Bastion',
    minFloor: 150,
    frictionMultiplier: 0.78,
    skyTop: '#071329',
    skyBottom: '#122952',
    archColor: '#0e2042',
    archHighlight: '#1e3e7a',
    wallBase: '#182b4d',
    wallTrim: '#d8aa3d',
    platformTop: '#3e72c4',
    platformBody: '#1b386b',
    platformBorder: '#0a162e',
    platformAccent: '#f5cf67',
    ambientEmber: '#6ec4ff',
  },
  {
    id: 'warpstorm',
    name: 'ORBITAL APEX',
    subtitle: 'Edge of the Empyrean',
    minFloor: 200,
    frictionMultiplier: 0.72,
    skyTop: '#070a12',
    skyBottom: '#1c1224',
    archColor: '#121224',
    archHighlight: '#362c52',
    wallBase: '#1c1d2b',
    wallTrim: '#d4af37',
    platformTop: '#6c7ca3',
    platformBody: '#293045',
    platformBorder: '#0b0d17',
    platformAccent: '#5cf0ff',
    ambientEmber: '#66f3ff',
  },
];

export function getBiomeForFloor(floor: number): BiomeTheme {
  let active = BIOMES[0];
  for (const biome of BIOMES) {
    if (floor >= biome.minFloor) {
      active = biome;
    }
  }
  return active;
}

export function getBiomeById(id: BiomeId): BiomeTheme {
  return BIOMES.find((b) => b.id === id) ?? BIOMES[0];
}

export function getComboRank(floors: number): ComboRank | null {
  for (const rank of COMBO_RANKS) {
    if (floors >= rank.minFloors) {
      return rank;
    }
  }
  return null;
}
