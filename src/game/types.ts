export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type ChapterId =
  | 'ultramarines'
  | 'blood_angels'
  | 'salamanders'
  | 'imperial_fists'
  | 'dark_angels';

export interface ChapterTheme {
  id: ChapterId;
  name: string;
  shortName: string;
  motto: string;
  armorLight: string;
  armorMid: string;
  armorDark: string;
  trim: string;
  trimDark: string;
  eyeColor: string;
  eyeGlow: string;
  crestColor: string;
  emblemColor: string;
  thrusterCore: string;
  thrusterCombo: string;
}

export type BiomeId =
  | 'underhive'
  | 'ecclesiarchy'
  | 'mechanicus'
  | 'fortress'
  | 'warpstorm';

export interface BiomeTheme {
  id: BiomeId;
  name: string;
  subtitle: string;
  minFloor: number;
  frictionMultiplier: number;
  skyTop: string;
  skyBottom: string;
  archColor: string;
  archHighlight: string;
  wallBase: string;
  wallTrim: string;
  platformTop: string;
  platformBody: string;
  platformBorder: string;
  platformAccent: string;
  ambientEmber: string;
}

export interface Platform {
  floor: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isMilestone: boolean;
  biomeId: BiomeId;
  /** Subtle flash timer (seconds) when the Space Marine lands on it */
  landFlash: number;
}

export type EnemyKind = 'heretic' | 'drone';

export interface ChaosEnemy {
  id: number;
  kind: EnemyKind;
  floor: number;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  minX: number;
  maxX: number;
  baseY: number;
  phase: number;
  alive: boolean;
}

export type PickupKind = 'seal' | 'halo' | 'overcharge';

export interface ImperialPickup {
  id: number;
  kind: PickupKind;
  floor: number;
  x: number;
  y: number;
  radius: number;
  phase: number;
  collected: boolean;
}

export interface PuritySealSegment {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: 1 | -1;
  grounded: boolean;
  currentFloor: number;
  highestFloor: number;
  /** True during speed-boosted combo leaps */
  isSpinning: boolean;
  spinAngle: number;
  /** Remaining coyote time in seconds */
  coyoteTimer: number;
  /** Remaining jump buffer time in seconds */
  jumpBufferTimer: number;
  /** Animation phase for running boots */
  runCycle: number;
  /** Visual squash/stretch factor (1 = normal, >1 stretched vertically, <1 squashed) */
  squashY: number;
  /** Remaining thruster glow time in seconds */
  thrusterTimer: number;
  /** Remaining wall-kick visual cooldown */
  wallBounceFlash: number;
  /** Last floor index jumped from (used to measure floors cleared in one leap) */
  jumpStartFloor: number;
  /** Iron Halo protective shield active */
  hasIronHalo: boolean;
  /** Remaining Jump-Pack Overcharge rocket ascent seconds */
  overchargeTimer: number;
  /** Brief post-hit / post-shield invulnerability timer in seconds */
  invulnTimer: number;
  /** Trailing purity seal ribbon points in world coordinates */
  sealTrail: PuritySealSegment[];
}

export interface ComboState {
  /** Whether a combo chain is currently active */
  active: boolean;
  /** Total floors climbed during the current combo */
  floors: number;
  /** Number of consecutive multi-floor leaps in this combo */
  jumps: number;
  /** Remaining combo gauge time in seconds (0..COMBO_DURATION) */
  timer: number;
  /** Max combo gauge duration in seconds */
  maxTimer: number;
}

export interface ComboRank {
  minFloors: number;
  title: string;
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  gravity: number;
  shape: 'square' | 'spark' | 'ring' | 'ember';
}

export interface FloatingBanner {
  text: string;
  subtext?: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  scale: number;
  isScreenSpace: boolean;
}

export interface InputState {
  left: boolean;
  right: boolean;
  /** Continuous horizontal axis in [-1, 1] for smooth touch rocker or analog stick */
  axisX: number;
  jumpHeld: boolean;
  jumpPressed: boolean;
}

export interface PersistedRecords {
  bestScore: number;
  bestFloor: number;
  bestCombo: number;
  totalPurges: number;
  totalRuns: number;
}

export type TouchLayoutMode = 'rocker' | 'buttons';

export interface GameSettings {
  chapter: ChapterId;
  muted: boolean;
  showTouchControls: 'auto' | 'on' | 'off';
  touchLayout: TouchLayoutMode;
  autoJump: boolean;
  swapTouchSides: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  chapter: ChapterId;
  score: number;
  floor: number;
  purges: number;
  hasIronHalo: boolean;
  overchargeActive: boolean;
  bestScore: number;
  bestFloor: number;
  bestCombo: number;
  comboActive: boolean;
  comboFloors: number;
  comboRatio: number;
  hurryLevel: number;
  biomeName: string;
  biomeSubtitle: string;
  isNewBestScore: boolean;
  runBestCombo: number;
}
