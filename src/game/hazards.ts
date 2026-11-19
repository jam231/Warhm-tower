import {
  FLOOR_SPACING,
  SHAFT_LEFT,
  SHAFT_RIGHT,
} from './constants';
import type {
  ChaosEnemy,
  ImperialPickup,
  PickupKind,
  Platform,
  Player,
} from './types';

export type RngFn = () => number;

export interface HazardInteractionEvents {
  purgedEnemies: Array<{ enemy: ChaosEnemy; points: number }>;
  shieldBrokenAt: { x: number; y: number } | null;
  playerKnocked: boolean;
  collectedPickups: Array<{ pickup: ImperialPickup; points: number; grantedHalo: boolean }>;
}

export const HERETIC_PURGE_POINTS = 75;
export const DRONE_PURGE_POINTS = 120;
export const SEAL_PICKUP_POINTS = 60;
export const DUPLICATE_HALO_POINTS = 100;
export const OVERCHARGE_DURATION = 1.28;
export const OVERCHARGE_CLIMB_VY = -960;

export class HazardManager {
  public enemies: ChaosEnemy[] = [];
  public pickups: ImperialPickup[] = [];
  private nextId = 1;
  private processedMaxFloor = -1;
  private readonly rng: RngFn;

  constructor(rng: RngFn = Math.random) {
    this.rng = rng;
  }

  public reset(): void {
    this.enemies = [];
    this.pickups = [];
    this.nextId = 1;
    this.processedMaxFloor = -1;
  }

  /**
   * Populates Chaos enemies and Imperial relics for newly generated platforms.
   * Never crowds milestone decks (every 10 floors) or early warm-up floors.
   */
  public populateForPlatforms(platforms: readonly Platform[]): void {
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (p.floor <= this.processedMaxFloor) continue;
      this.processedMaxFloor = p.floor;

      if (p.floor < 7 || p.isMilestone) continue;

      let spawnedEnemy = false;

      // 1. Patrolling Chaos Cultist / Pox-Heretic on platforms (Floor 12+)
      if (p.floor >= 12 && p.width >= 108) {
        const hereticChance = Math.min(0.24, 0.1 + (p.floor - 12) * 0.0012);
        if (this.rng() < hereticChance) {
          const w = 26;
          const h = 32;
          const speed = 58 + Math.min(55, p.floor * 0.32) + this.rng() * 24;
          const dir = this.rng() < 0.5 ? 1 : -1;
          const x = p.x + 8 + this.rng() * Math.max(2, p.width - w - 16);
          this.enemies.push({
            id: this.nextId++,
            kind: 'heretic',
            floor: p.floor,
            x,
            y: p.y - h,
            width: w,
            height: h,
            vx: dir * speed,
            minX: p.x + 4,
            maxX: p.x + p.width - w - 4,
            baseY: p.y - h,
            phase: this.rng() * Math.PI * 2,
            alive: true,
          });
          spawnedEnemy = true;
        }
      }

      // 2. Hovering Chaos Blight Drone in mid-air between floors (Floor 30+)
      if (!spawnedEnemy && p.floor >= 30) {
        const droneChance = Math.min(0.16, 0.06 + (p.floor - 30) * 0.0008);
        if (this.rng() < droneChance) {
          const w = 30;
          const h = 26;
          const baseY = p.y - FLOOR_SPACING * 0.52;
          const speed = 78 + Math.min(60, (p.floor - 30) * 0.35);
          const minX = SHAFT_LEFT + 22;
          const maxX = SHAFT_RIGHT - w - 22;
          const x = minX + this.rng() * Math.max(10, maxX - minX);
          this.enemies.push({
            id: this.nextId++,
            kind: 'drone',
            floor: p.floor,
            x,
            y: baseY,
            width: w,
            height: h,
            vx: (this.rng() < 0.5 ? 1 : -1) * speed,
            minX,
            maxX,
            baseY,
            phase: this.rng() * Math.PI * 2,
            alive: true,
          });
          spawnedEnemy = true;
        }
      }

      // 3. Collectible Imperial Relics on clear platforms (Floor 8+)
      if (!spawnedEnemy && p.floor >= 8) {
        const pickupRoll = this.rng();
        let kind: PickupKind | null = null;
        if (p.floor >= 22 && pickupRoll < 0.032) {
          kind = 'overcharge';
        } else if (p.floor >= 14 && pickupRoll < 0.072) {
          kind = 'halo';
        } else if (pickupRoll < 0.165) {
          kind = 'seal';
        }

        if (kind) {
          this.pickups.push({
            id: this.nextId++,
            kind,
            floor: p.floor,
            x: p.x + p.width * (0.28 + this.rng() * 0.44),
            y: p.y - 28,
            radius: 14,
            phase: this.rng() * Math.PI * 2,
            collected: false,
          });
        }
      }
    }
  }

  public update(dt: number, time: number): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;

      e.x += e.vx * dt;
      if (e.x <= e.minX) {
        e.x = e.minX;
        e.vx = Math.abs(e.vx);
      } else if (e.x >= e.maxX) {
        e.x = e.maxX;
        e.vx = -Math.abs(e.vx);
      }

      if (e.kind === 'drone') {
        e.y = e.baseY + Math.sin(time * 3.8 + e.phase) * 9;
      }
    }
  }

  public resolvePlayerInteractions(player: Player): HazardInteractionEvents {
    const events: HazardInteractionEvents = {
      purgedEnemies: [],
      shieldBrokenAt: null,
      playerKnocked: false,
      collectedPickups: [],
    };

    const px1 = player.x + 3;
    const py1 = player.y + 4;
    const px2 = player.x + player.width - 3;
    const py2 = player.y + player.height;
    const pcx = player.x + player.width * 0.5;
    const pcy = player.y + player.height * 0.5;

    // 1. Resolve Imperial Pickups
    for (let i = 0; i < this.pickups.length; i++) {
      const item = this.pickups[i];
      if (item.collected) continue;

      const dx = pcx - item.x;
      const dy = pcy - item.y;
      const hitDist = item.radius + 18;
      if (dx * dx + dy * dy <= hitDist * hitDist) {
        item.collected = true;
        if (item.kind === 'seal') {
          events.collectedPickups.push({
            pickup: item,
            points: SEAL_PICKUP_POINTS,
            grantedHalo: false,
          });
        } else if (item.kind === 'halo') {
          if (!player.hasIronHalo) {
            player.hasIronHalo = true;
            events.collectedPickups.push({
              pickup: item,
              points: 25,
              grantedHalo: true,
            });
          } else {
            events.collectedPickups.push({
              pickup: item,
              points: DUPLICATE_HALO_POINTS,
              grantedHalo: false,
            });
          }
        } else if (item.kind === 'overcharge') {
          player.overchargeTimer = OVERCHARGE_DURATION;
          player.grounded = false;
          player.isSpinning = true;
          player.vy = OVERCHARGE_CLIMB_VY;
          player.thrusterTimer = OVERCHARGE_DURATION + 0.25;
          player.jumpStartFloor = player.currentFloor;
          events.collectedPickups.push({
            pickup: item,
            points: 50,
            grantedHalo: false,
          });
        }
      }
    }

    // 2. Resolve Chaos Enemies
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (!enemy.alive) continue;

      const ex1 = enemy.x + 2;
      const ey1 = enemy.y + 2;
      const ex2 = enemy.x + enemy.width - 2;
      const ey2 = enemy.y + enemy.height - 2;

      const overlaps = px2 > ex1 && px1 < ex2 && py2 > ey1 && py1 < ey2;
      if (!overlaps) continue;

      const enemyMidY = enemy.y + enemy.height * 0.56;
      const isStomping = player.vy > -40 && py2 <= enemyMidY + 14;
      const isLethalAssault = isStomping || player.isSpinning || player.overchargeTimer > 0;

      if (isLethalAssault) {
        enemy.alive = false;
        const points = enemy.kind === 'drone' ? DRONE_PURGE_POINTS : HERETIC_PURGE_POINTS;

        if (player.overchargeTimer <= 0) {
          // Juicy stomp / smash rebound upward!
          const bounceVy = enemy.kind === 'drone' ? -845 : -775;
          player.vy = Math.min(player.vy, bounceVy);
          player.grounded = false;
          player.isSpinning = true;
          player.thrusterTimer = Math.max(player.thrusterTimer, 0.34);
          player.squashY = 1.22;
        }

        events.purgedEnemies.push({ enemy, points });
        continue;
      }

      if (player.invulnTimer > 0) {
        continue;
      }

      // Non-lethal collision from side/below: Iron Halo absorbs & purges attacker!
      if (player.hasIronHalo) {
        player.hasIronHalo = false;
        player.invulnTimer = 1.15;
        enemy.alive = false;
        const points = enemy.kind === 'drone' ? DRONE_PURGE_POINTS : HERETIC_PURGE_POINTS;
        player.vy = Math.min(player.vy, -560);
        events.shieldBrokenAt = { x: pcx, y: pcy };
        events.purgedEnemies.push({ enemy, points });
      } else {
        // Knockback disruption (fair, recoverable — never cheap instant-kill)
        const enemyCenterX = enemy.x + enemy.width * 0.5;
        const knockDir = pcx < enemyCenterX ? -1 : 1;
        player.vx = knockDir * 310;
        player.vy = Math.min(player.vy, -280);
        player.grounded = false;
        player.isSpinning = false;
        player.invulnTimer = 1.15;
        events.playerKnocked = true;
      }
    }

    return events;
  }

  public pruneBelow(worldY: number): void {
    const cutoff = worldY + 260;
    this.enemies = this.enemies.filter((e) => e.alive && e.y <= cutoff);
    this.pickups = this.pickups.filter((p) => !p.collected && p.y <= cutoff);
  }
}
