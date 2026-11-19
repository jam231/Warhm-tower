import {
  FLOOR_SPACING,
  MILESTONE_INTERVAL,
  PLATFORM_HEIGHT,
  SHAFT_LEFT,
  SHAFT_RIGHT,
  SHAFT_WIDTH,
  getBiomeForFloor,
} from './constants';
import type { Platform } from './types';

export type RngFn = () => number;

export function createFloorPlatform(
  floor: number,
  prevPlatform: Platform | null,
  rng: RngFn = Math.random,
): Platform {
  const y = -floor * FLOOR_SPACING;
  const biome = getBiomeForFloor(floor);
  const isMilestone = floor === 0 || floor % MILESTONE_INTERVAL === 0;

  if (isMilestone) {
    return {
      floor,
      x: SHAFT_LEFT,
      y,
      width: SHAFT_WIDTH,
      height: PLATFORM_HEIGHT + (floor === 0 ? 10 : 2),
      isMilestone: true,
      biomeId: biome.id,
      landFlash: 0,
    };
  }

  // Smoothly narrow platforms with altitude while staying fair and fun
  const difficulty = Math.min(1, floor / 180);
  const minW = Math.round(152 - difficulty * 60); // 152 -> 92
  const maxW = Math.round(212 - difficulty * 76); // 212 -> 136
  const width = Math.round(minW + rng() * (maxW - minW));

  const minX = SHAFT_LEFT;
  const maxX = SHAFT_RIGHT - width;

  let x: number;
  if (!prevPlatform || prevPlatform.isMilestone) {
    // Coming off a full-width bastion deck: anywhere across the shaft
    x = minX + rng() * (maxX - minX);
  } else {
    // Guarantee reachability from prevPlatform while encouraging lateral movement
    const maxEdgeGap = 118;
    const reachableMin = Math.max(minX, prevPlatform.x - width - maxEdgeGap);
    const reachableMax = Math.min(maxX, prevPlatform.x + prevPlatform.width + maxEdgeGap);

    const prevCenter = prevPlatform.x + prevPlatform.width / 2;
    const shaftMid = SHAFT_LEFT + SHAFT_WIDTH / 2;

    // Bias slightly toward the opposite side of the shaft for dynamic zig-zag climbs
    const goRight = prevCenter < shaftMid ? rng() < 0.72 : rng() < 0.28;
    const minShift = 58;

    let candidateMin = reachableMin;
    let candidateMax = reachableMax;

    if (goRight) {
      const shiftedMin = prevPlatform.x + minShift;
      if (shiftedMin < reachableMax) {
        candidateMin = Math.max(reachableMin, shiftedMin);
      }
    } else {
      const shiftedMax = prevPlatform.x + prevPlatform.width - width - minShift;
      if (shiftedMax > reachableMin) {
        candidateMax = Math.min(reachableMax, shiftedMax);
      }
    }

    if (candidateMax <= candidateMin) {
      candidateMin = reachableMin;
      candidateMax = reachableMax;
    }

    x = candidateMin + rng() * (candidateMax - candidateMin);
  }

  return {
    floor,
    x: Math.round(Math.max(minX, Math.min(maxX, x))),
    y,
    width,
    height: PLATFORM_HEIGHT,
    isMilestone: false,
    biomeId: biome.id,
    landFlash: 0,
  };
}

export class PlatformManager {
  public platforms: Platform[] = [];
  private highestGenerated = -1;
  private readonly rng: RngFn;

  constructor(rng: RngFn = Math.random) {
    this.rng = rng;
    this.reset();
  }

  public reset(): void {
    this.platforms = [];
    this.highestGenerated = -1;
    this.ensureGeneratedUpTo(30);
  }

  public ensureGeneratedUpTo(targetFloor: number): void {
    while (this.highestGenerated < targetFloor) {
      const nextFloor = this.highestGenerated + 1;
      const prev = this.platforms.length > 0 ? this.platforms[this.platforms.length - 1] : null;
      this.platforms.push(createFloorPlatform(nextFloor, prev, this.rng));
      this.highestGenerated = nextFloor;
    }
  }

  public pruneBelow(worldY: number): void {
    // Keep a generous buffer below the camera bottom
    const cutoff = worldY + 260;
    while (this.platforms.length > 0 && this.platforms[0].y > cutoff) {
      this.platforms.shift();
    }
  }
}
