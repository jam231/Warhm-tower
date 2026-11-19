import { describe, expect, it } from 'vitest';
import { CHAPTERS, getChapterTheme } from '../src/game/chapters';
import {
  FIXED_DT,
  FLOOR_SPACING,
  MILESTONE_INTERVAL,
  SHAFT_LEFT,
  SHAFT_RIGHT,
  SHAFT_WIDTH,
} from '../src/game/constants';
import {
  createComboState,
  registerFloorLanding,
  tickCombo,
} from '../src/game/combo';
import {
  HERETIC_PURGE_POINTS,
  HazardManager,
  OVERCHARGE_CLIMB_VY,
} from '../src/game/hazards';
import { createPlayer, stepPlayerPhysics } from '../src/game/physics';
import { PlatformManager } from '../src/game/platformGenerator';
import type { InputState } from '../src/game/types';

const IDLE_INPUT: InputState = {
  left: false,
  right: false,
  axisX: 0,
  jumpHeld: false,
  jumpPressed: false,
};

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Space Marine Chapters', () => {
  it('provides 5 distinct selectable Chapters with Ultramarines as default fallback', () => {
    expect(CHAPTERS.length).toBe(5);
    const ids = new Set(CHAPTERS.map((c) => c.id));
    expect(ids.size).toBe(5);
    expect(getChapterTheme('ultramarines').name).toBe('Ultramarines');
    expect(getChapterTheme('blood_angels').name).toBe('Blood Angels');
    expect(getChapterTheme('salamanders').name).toBe('Salamanders');
    expect(getChapterTheme('imperial_fists').name).toBe('Imperial Fists');
    expect(getChapterTheme('dark_angels').name).toBe('Dark Angels');
  });
});

describe('PlatformGenerator', () => {
  it('generates full-width milestone decks every 10 floors and keeps all platforms reachable inside the shaft', () => {
    const mgr = new PlatformManager(mulberry32(40000));
    mgr.ensureGeneratedUpTo(250);

    expect(mgr.platforms.length).toBe(251);

    for (let i = 0; i < mgr.platforms.length; i++) {
      const p = mgr.platforms[i];
      expect(p.floor).toBe(i);
      expect(p.y).toBe(-i * FLOOR_SPACING);
      expect(p.x).toBeGreaterThanOrEqual(SHAFT_LEFT);
      expect(p.x + p.width).toBeLessThanOrEqual(SHAFT_RIGHT);

      if (i % MILESTONE_INTERVAL === 0) {
        expect(p.isMilestone).toBe(true);
        expect(p.x).toBe(SHAFT_LEFT);
        expect(p.width).toBe(SHAFT_WIDTH);
      } else if (i > 0) {
        const prev = mgr.platforms[i - 1];
        if (!prev.isMilestone) {
          const gapRight = p.x - (prev.x + prev.width);
          const gapLeft = prev.x - (p.x + p.width);
          const edgeGap = Math.max(0, gapRight, gapLeft);
          expect(edgeGap).toBeLessThanOrEqual(120);
        }
      }
    }
  });
});

describe('Space Marine Physics', () => {
  it('clears Floor 1 from a standing jump', () => {
    const mgr = new PlatformManager(mulberry32(42));
    const player = createPlayer();

    let minY = player.y;
    for (let frame = 0; frame < 60; frame++) {
      const input: InputState = {
        ...IDLE_INPUT,
        jumpHeld: true,
        jumpPressed: frame === 0,
      };
      stepPlayerPhysics(player, input, mgr.platforms, FIXED_DT);
      if (player.y < minY) minY = player.y;
    }

    const peakFeetY = minY + player.height;
    expect(peakFeetY).toBeLessThan(-FLOOR_SPACING - 15);
  });

  it('triggers a spinning super-jump that clears 3+ floors when sprinting at high speed', () => {
    const mgr = new PlatformManager(mulberry32(7));
    const player = createPlayer();
    player.vx = 430;

    const firstStep = stepPlayerPhysics(
      player,
      { left: false, right: true, axisX: 1, jumpHeld: true, jumpPressed: true },
      mgr.platforms,
      FIXED_DT,
    );

    expect(firstStep.jumped).toBe(true);
    expect(firstStep.superJump).toBe(true);
    expect(player.isSpinning).toBe(true);

    let minY = player.y;
    for (let frame = 0; frame < 75; frame++) {
      stepPlayerPhysics(
        player,
        { left: false, right: false, axisX: 0, jumpHeld: true, jumpPressed: false },
        [],
        FIXED_DT,
      );
      if (player.y < minY) minY = player.y;
    }

    const peakFeetY = minY + player.height;
    expect(peakFeetY).toBeLessThan(-FLOOR_SPACING * 3);
  });

  it('rebounds cleanly off fortress walls while airborne and preserves momentum', () => {
    const player = createPlayer();
    player.grounded = false;
    player.x = SHAFT_RIGHT - player.width - 2;
    player.y = -200;
    player.vx = 360;
    player.vy = -100;

    const ev = stepPlayerPhysics(player, IDLE_INPUT, [], FIXED_DT);

    expect(ev.wallBounced).toBe(true);
    expect(ev.wallBounceSide).toBe(1);
    expect(player.vx).toBeLessThan(-320);
    expect(player.facing).toBe(-1);
    expect(player.vy).toBeLessThan(-100);
  });

  it('automatically leaps when grounded if autoJump is enabled', () => {
    const mgr = new PlatformManager(mulberry32(99));
    const player = createPlayer();
    const ev = stepPlayerPhysics(player, IDLE_INPUT, mgr.platforms, FIXED_DT, true);
    expect(ev.jumped).toBe(true);
    expect(player.grounded).toBe(false);
    expect(player.vy).toBeLessThan(-600);
  });
});

describe('Chaos Enemies & Imperial Relics', () => {
  it('purges a Chaos Heretic when stomped from above and rebounds upward', () => {
    const hazards = new HazardManager(mulberry32(1));
    hazards.enemies.push({
      id: 1,
      kind: 'heretic',
      floor: 15,
      x: 200,
      y: -300,
      width: 26,
      height: 32,
      vx: 60,
      minX: 140,
      maxX: 280,
      baseY: -300,
      phase: 0,
      alive: true,
    });

    const player = createPlayer();
    player.grounded = false;
    player.x = 198;
    player.y = -340; // feet at -292, landing on upper half of heretic (-300..-268)
    player.vy = 260;

    const ev = hazards.resolvePlayerInteractions(player);
    expect(ev.purgedEnemies.length).toBe(1);
    expect(ev.purgedEnemies[0].points).toBe(HERETIC_PURGE_POINTS);
    expect(hazards.enemies[0].alive).toBe(false);
    expect(player.vy).toBeLessThan(-700);
    expect(player.isSpinning).toBe(true);
  });

  it('absorbs a side collision using an active Iron Halo shield and purges the attacker', () => {
    const hazards = new HazardManager(mulberry32(2));
    hazards.enemies.push({
      id: 2,
      kind: 'heretic',
      floor: 18,
      x: 200,
      y: -300,
      width: 26,
      height: 32,
      vx: -60,
      minX: 140,
      maxX: 280,
      baseY: -300,
      phase: 0,
      alive: true,
    });

    const player = createPlayer();
    player.hasIronHalo = true;
    player.grounded = true;
    player.x = 185;
    player.y = -316; // side-to-side overlap at same platform level
    player.vy = 0;

    const ev = hazards.resolvePlayerInteractions(player);
    expect(player.hasIronHalo).toBe(false);
    expect(ev.shieldBrokenAt).not.toBeNull();
    expect(ev.purgedEnemies.length).toBe(1);
    expect(ev.playerKnocked).toBe(false);
    expect(player.invulnTimer).toBeGreaterThan(0.5);
  });

  it('grants Jump-Pack Overcharge rocket ascent on collecting an overcharge cell', () => {
    const hazards = new HazardManager(mulberry32(3));
    hazards.pickups.push({
      id: 10,
      kind: 'overcharge',
      floor: 25,
      x: 220,
      y: -400,
      radius: 14,
      phase: 0,
      collected: false,
    });

    const player = createPlayer();
    player.x = 205;
    player.y = -420;
    const ev = hazards.resolvePlayerInteractions(player);

    expect(ev.collectedPickups.length).toBe(1);
    expect(player.overchargeTimer).toBeGreaterThan(1);
    expect(player.vy).toBe(OVERCHARGE_CLIMB_VY);
    expect(player.isSpinning).toBe(true);
  });
});

describe('Combo System', () => {
  it('chains multi-floor leaps and awards quadratic bonus upon a single-floor step', () => {
    const combo = createComboState();

    const step1 = registerFloorLanding(combo, 3);
    expect(step1.type).toBe('extended');
    expect(combo.active).toBe(true);
    expect(combo.floors).toBe(3);

    const step2 = registerFloorLanding(combo, 4);
    expect(step2.type).toBe('extended');
    expect(combo.floors).toBe(7);

    const end = registerFloorLanding(combo, 1);
    expect(end.type).toBe('completed');
    if (end.type === 'completed') {
      expect(end.totalComboFloors).toBe(7);
      expect(end.bonus).toBe(49);
      expect(end.rank?.title).toBe('FOR MACRAGGE!');
    }
    expect(combo.active).toBe(false);
  });

  it('cashes out active combo when timer expires', () => {
    const combo = createComboState();
    registerFloorLanding(combo, 2);
    registerFloorLanding(combo, 3);
    expect(combo.floors).toBe(5);

    const mid = tickCombo(combo, 1.0);
    expect(mid.type).toBe('none');
    expect(combo.active).toBe(true);

    const done = tickCombo(combo, 3.0);
    expect(done.type).toBe('completed');
    if (done.type === 'completed') {
      expect(done.bonus).toBe(25);
      expect(done.rank?.title).toBe('WORTHY!');
    }
  });
});
