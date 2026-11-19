import {
  COMBO_DURATION,
  COMBO_MIN_FLOORS_TO_SCORE,
  getComboRank,
} from './constants';
import type { ComboRank, ComboState } from './types';

export type ComboEvent =
  | { type: 'none' }
  | { type: 'extended'; floorsJumped: number; totalComboFloors: number; jumps: number }
  | { type: 'completed'; totalComboFloors: number; bonus: number; rank: ComboRank | null };

export function createComboState(): ComboState {
  return {
    active: false,
    floors: 0,
    jumps: 0,
    timer: 0,
    maxTimer: COMBO_DURATION,
  };
}

export function finishCombo(combo: ComboState): ComboEvent {
  if (!combo.active) {
    return { type: 'none' };
  }
  const totalComboFloors = combo.floors;
  const qualifies = totalComboFloors >= COMBO_MIN_FLOORS_TO_SCORE;
  const bonus = qualifies ? totalComboFloors * totalComboFloors : 0;
  const rank = qualifies ? getComboRank(totalComboFloors) : null;

  combo.active = false;
  combo.floors = 0;
  combo.jumps = 0;
  combo.timer = 0;

  if (!qualifies) {
    return { type: 'none' };
  }

  return {
    type: 'completed',
    totalComboFloors,
    bonus,
    rank,
  };
}

export function registerFloorLanding(
  combo: ComboState,
  floorsJumped: number,
): ComboEvent {
  if (floorsJumped >= 2) {
    combo.active = true;
    combo.floors += floorsJumped;
    combo.jumps += 1;
    combo.timer = combo.maxTimer;
    return {
      type: 'extended',
      floorsJumped,
      totalComboFloors: combo.floors,
      jumps: combo.jumps,
    };
  }

  // Single-floor step or dropping back ends the active combo
  if (combo.active) {
    return finishCombo(combo);
  }

  return { type: 'none' };
}

export function tickCombo(combo: ComboState, dt: number): ComboEvent {
  if (!combo.active) {
    return { type: 'none' };
  }
  combo.timer -= dt;
  if (combo.timer <= 0) {
    return finishCombo(combo);
  }
  return { type: 'none' };
}
