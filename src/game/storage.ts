import { CHAPTERS } from './chapters';
import type { ChapterId, GameSettings, PersistedRecords } from './types';

const RECORDS_KEY = 'spires_of_ultramar_records_v1';
const SETTINGS_KEY = 'spires_of_ultramar_settings_v1';

const DEFAULT_RECORDS: PersistedRecords = {
  bestScore: 0,
  bestFloor: 0,
  bestCombo: 0,
  totalPurges: 0,
  totalRuns: 0,
};

const DEFAULT_SETTINGS: GameSettings = {
  chapter: 'ultramarines',
  muted: false,
  showTouchControls: 'auto',
  touchLayout: 'rocker',
  autoJump: false,
  swapTouchSides: false,
};

function isValidChapter(value: unknown): value is ChapterId {
  return typeof value === 'string' && CHAPTERS.some((c) => c.id === value);
}

export function loadRecords(): PersistedRecords {
  try {
    const raw = window.localStorage.getItem(RECORDS_KEY);
    if (!raw) return { ...DEFAULT_RECORDS };
    const parsed = JSON.parse(raw) as Partial<PersistedRecords>;
    return {
      bestScore: typeof parsed.bestScore === 'number' && parsed.bestScore >= 0 ? parsed.bestScore : 0,
      bestFloor: typeof parsed.bestFloor === 'number' && parsed.bestFloor >= 0 ? parsed.bestFloor : 0,
      bestCombo: typeof parsed.bestCombo === 'number' && parsed.bestCombo >= 0 ? parsed.bestCombo : 0,
      totalPurges:
        typeof parsed.totalPurges === 'number' && parsed.totalPurges >= 0 ? parsed.totalPurges : 0,
      totalRuns: typeof parsed.totalRuns === 'number' && parsed.totalRuns >= 0 ? parsed.totalRuns : 0,
    };
  } catch {
    return { ...DEFAULT_RECORDS };
  }
}

export function saveRecords(records: PersistedRecords): void {
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota failures
  }
}

export function loadSettings(): GameSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      chapter: isValidChapter(parsed.chapter) ? parsed.chapter : DEFAULT_SETTINGS.chapter,
      muted: Boolean(parsed.muted),
      showTouchControls:
        parsed.showTouchControls === 'on' || parsed.showTouchControls === 'off'
          ? parsed.showTouchControls
          : 'auto',
      touchLayout: parsed.touchLayout === 'buttons' ? 'buttons' : 'rocker',
      autoJump: Boolean(parsed.autoJump),
      swapTouchSides: Boolean(parsed.swapTouchSides),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota failures
  }
}
