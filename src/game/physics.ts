import {
  AIR_ACCEL,
  AIR_DRAG,
  BASE_JUMP_VY,
  COYOTE_TIME,
  GRAVITY,
  GROUND_ACCEL,
  GROUND_FRICTION,
  GROUND_TURN_ACCEL,
  JUMP_BUFFER_TIME,
  MAX_AIR_SPEED,
  MAX_FALL_SPEED,
  MAX_RUN_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SHAFT_LEFT,
  SHAFT_RIGHT,
  SPEED_JUMP_RATIO,
  SPIN_SPEED_THRESHOLD,
  VARIABLE_JUMP_CUT,
  WALL_BOUNCE_BOOST_VX,
  WALL_BOUNCE_LIFT_VY,
  WALL_BOUNCE_MIN_SPEED,
  WALL_BOUNCE_RETENTION,
  getBiomeForFloor,
} from './constants';
import { OVERCHARGE_CLIMB_VY } from './hazards';
import type { InputState, Platform, Player } from './types';

export interface PhysicsStepEvents {
  jumped: boolean;
  superJump: boolean;
  wallBounced: boolean;
  wallBounceSide: -1 | 1 | 0;
  wallBounceSpeed: number;
  landedPlatform: Platform | null;
  floorsJumped: number;
  skidding: boolean;
}

export function createPlayer(): Player {
  const startX = (SHAFT_LEFT + SHAFT_RIGHT) / 2 - PLAYER_WIDTH / 2;
  const startY = -PLAYER_HEIGHT;
  const sealTrail = Array.from({ length: 5 }, (_, i) => ({
    x: startX + PLAYER_WIDTH * 0.5,
    y: startY + 20 + i * 5,
  }));

  return {
    x: startX,
    y: startY,
    vx: 0,
    vy: 0,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    facing: 1,
    grounded: true,
    currentFloor: 0,
    highestFloor: 0,
    isSpinning: false,
    spinAngle: 0,
    coyoteTimer: COYOTE_TIME,
    jumpBufferTimer: 0,
    runCycle: 0,
    squashY: 1,
    thrusterTimer: 0,
    wallBounceFlash: 0,
    jumpStartFloor: 0,
    hasIronHalo: false,
    overchargeTimer: 0,
    invulnTimer: 0,
    sealTrail,
  };
}

export function stepPlayerPhysics(
  player: Player,
  input: InputState,
  platforms: readonly Platform[],
  dt: number,
  autoJump = false,
): PhysicsStepEvents {
  const events: PhysicsStepEvents = {
    jumped: false,
    superJump: false,
    wallBounced: false,
    wallBounceSide: 0,
    wallBounceSpeed: 0,
    landedPlatform: null,
    floorsJumped: 0,
    skidding: false,
  };

  if (player.invulnTimer > 0) {
    player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  }

  // Horizontal intent (-1..1)
  let moveDir = input.axisX;
  if (Math.abs(moveDir) < 0.05) {
    moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  }
  moveDir = Math.max(-1, Math.min(1, moveDir));

  const biome = getBiomeForFloor(player.currentFloor);
  const frictionMult = biome.frictionMultiplier;

  // Horizontal acceleration & friction
  if (Math.abs(moveDir) > 0.05) {
    player.facing = moveDir > 0 ? 1 : -1;
    const reversing = player.vx !== 0 && Math.sign(moveDir) !== Math.sign(player.vx);

    if (player.grounded) {
      const accel = (reversing ? GROUND_TURN_ACCEL : GROUND_ACCEL) * (0.55 + 0.45 * frictionMult);
      player.vx += moveDir * accel * dt;
      if (reversing && Math.abs(player.vx) > 150) {
        events.skidding = true;
      }
    } else {
      player.vx += moveDir * AIR_ACCEL * dt;
    }
  } else {
    if (player.grounded) {
      const decel = GROUND_FRICTION * frictionMult * dt;
      if (Math.abs(player.vx) <= decel) {
        player.vx = 0;
      } else {
        player.vx -= Math.sign(player.vx) * decel;
      }
    } else {
      const drag = AIR_DRAG * dt;
      if (Math.abs(player.vx) <= drag) {
        player.vx = 0;
      } else {
        player.vx -= Math.sign(player.vx) * drag;
      }
    }
  }

  // Clamp speed (allow extra speed in air after wall-bounces)
  const maxSpeed = player.grounded ? MAX_RUN_SPEED : MAX_AIR_SPEED;
  if (Math.abs(player.vx) > maxSpeed) {
    if (player.grounded) {
      player.vx = Math.sign(player.vx) * Math.max(maxSpeed, Math.abs(player.vx) - 600 * dt);
    } else {
      player.vx = Math.sign(player.vx) * maxSpeed;
    }
  }

  // Jump buffer & coyote timers (plus optional Auto-Jump mode for relaxed phone/iPad play)
  const effectiveJumpPressed = input.jumpPressed || (autoJump && player.grounded);
  const effectiveJumpHeld = input.jumpHeld || autoJump;

  if (effectiveJumpPressed) {
    player.jumpBufferTimer = JUMP_BUFFER_TIME;
  } else if (player.jumpBufferTimer > 0) {
    player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
  }

  if (player.grounded) {
    player.coyoteTimer = COYOTE_TIME;
  } else if (player.coyoteTimer > 0) {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  // Execute jump when buffered and within coyote window
  if (player.overchargeTimer <= 0 && player.jumpBufferTimer > 0 && player.coyoteTimer > 0) {
    const absVx = Math.abs(player.vx);
    const jumpVy = BASE_JUMP_VY - absVx * SPEED_JUMP_RATIO;
    const isSuper = absVx >= SPIN_SPEED_THRESHOLD;

    player.vy = jumpVy;
    player.grounded = false;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
    player.isSpinning = isSuper;
    player.spinAngle = 0;
    player.squashY = 1.24;
    player.thrusterTimer = isSuper ? 0.36 : 0.16;
    player.jumpStartFloor = player.currentFloor;

    events.jumped = true;
    events.superJump = isSuper;
  }

  // Jump-Pack Overcharge rocket boost overrides gravity while active
  if (player.overchargeTimer > 0) {
    player.overchargeTimer = Math.max(0, player.overchargeTimer - dt);
    player.vy = OVERCHARGE_CLIMB_VY;
    player.grounded = false;
    player.isSpinning = true;
    player.thrusterTimer = Math.max(player.thrusterTimer, 0.25);
  } else {
    // Variable jump height if jump released early (only on non-spin standard jumps)
    if (!effectiveJumpHeld && player.vy < -280 && !player.isSpinning) {
      player.vy *= Math.pow(VARIABLE_JUMP_CUT, dt * 15);
    }

    // Gravity
    player.vy = Math.min(MAX_FALL_SPEED, player.vy + GRAVITY * dt);
  }

  const prevBottom = player.y + player.height;

  // Integrate position
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Wall collision & Icy Tower rebound
  if (player.x < SHAFT_LEFT) {
    player.x = SHAFT_LEFT;
    const impactSpeed = Math.abs(player.vx);
    if (!player.grounded && impactSpeed >= WALL_BOUNCE_MIN_SPEED) {
      player.vx = Math.min(MAX_AIR_SPEED, impactSpeed * WALL_BOUNCE_RETENTION + WALL_BOUNCE_BOOST_VX);
      player.facing = 1;
      if (player.vy < 180 && player.overchargeTimer <= 0) {
        player.vy += WALL_BOUNCE_LIFT_VY;
      }
      if (Math.abs(player.vx) >= SPIN_SPEED_THRESHOLD) {
        player.isSpinning = true;
      }
      player.wallBounceFlash = 0.16;
      player.thrusterTimer = Math.max(player.thrusterTimer, 0.2);
      events.wallBounced = true;
      events.wallBounceSide = -1;
      events.wallBounceSpeed = impactSpeed;
    } else {
      player.vx = Math.max(0, -player.vx * 0.25);
    }
  } else if (player.x + player.width > SHAFT_RIGHT) {
    player.x = SHAFT_RIGHT - player.width;
    const impactSpeed = Math.abs(player.vx);
    if (!player.grounded && impactSpeed >= WALL_BOUNCE_MIN_SPEED) {
      player.vx = -Math.min(MAX_AIR_SPEED, impactSpeed * WALL_BOUNCE_RETENTION + WALL_BOUNCE_BOOST_VX);
      player.facing = -1;
      if (player.vy < 180 && player.overchargeTimer <= 0) {
        player.vy += WALL_BOUNCE_LIFT_VY;
      }
      if (Math.abs(player.vx) >= SPIN_SPEED_THRESHOLD) {
        player.isSpinning = true;
      }
      player.wallBounceFlash = 0.16;
      player.thrusterTimer = Math.max(player.thrusterTimer, 0.2);
      events.wallBounced = true;
      events.wallBounceSide = 1;
      events.wallBounceSpeed = impactSpeed;
    } else {
      player.vx = Math.min(0, -player.vx * 0.25);
    }
  }

  // One-way platform landing (only when moving downward)
  const newBottom = player.y + player.height;
  let landed: Platform | null = null;

  if (player.vy >= 0) {
    const footLeft = player.x + 5;
    const footRight = player.x + player.width - 5;

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (footRight > p.x && footLeft < p.x + p.width) {
        if (prevBottom <= p.y + 6 && newBottom >= p.y) {
          if (!landed || p.y < landed.y) {
            landed = p;
          }
        }
      }
    }
  }

  if (landed) {
    const wasAirborne = !player.grounded;
    const impactVy = player.vy;
    player.y = landed.y - player.height;
    player.vy = 0;
    player.grounded = true;
    player.isSpinning = false;
    player.spinAngle = 0;

    if (wasAirborne) {
      const floorsJumped = landed.floor - player.jumpStartFloor;
      player.currentFloor = landed.floor;
      if (landed.floor > player.highestFloor) {
        player.highestFloor = landed.floor;
      }
      landed.landFlash = 0.24;
      player.squashY = Math.max(0.76, 1 - Math.min(0.24, impactVy / 3200));

      events.landedPlatform = landed;
      events.floorsJumped = floorsJumped;
    } else {
      player.currentFloor = landed.floor;
    }
  } else {
    player.grounded = false;
  }

  // Animation timers & visual polish
  if (player.isSpinning) {
    const spinSpeed = 12.5 + Math.abs(player.vx) * 0.015;
    player.spinAngle += (player.vx >= 0 ? 1 : -1) * spinSpeed * dt;
  }

  if (player.grounded && Math.abs(player.vx) > 20) {
    player.runCycle += Math.abs(player.vx) * dt * 0.055;
  } else if (player.grounded) {
    player.runCycle = 0;
  }

  player.squashY += (1 - player.squashY) * Math.min(1, dt * 14);
  player.thrusterTimer = Math.max(0, player.thrusterTimer - dt);
  player.wallBounceFlash = Math.max(0, player.wallBounceFlash - dt);

  updatePuritySealTrail(player, dt);

  return events;
}

function updatePuritySealTrail(player: Player, dt: number): void {
  const anchorX = player.x + player.width * 0.5 - player.facing * 9;
  const anchorY = player.y + 21;
  const trail = player.sealTrail;
  if (trail.length === 0) return;

  trail[0].x = anchorX;
  trail[0].y = anchorY;

  const segLen = 5.5;
  for (let i = 1; i < trail.length; i++) {
    const prev = trail[i - 1];
    const curr = trail[i];
    curr.x += (-player.vx * 0.08 - player.facing * 24) * dt;
    curr.y += (85 - player.vy * 0.04) * dt;

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    if (dist > segLen) {
      curr.x = prev.x + (dx / dist) * segLen;
      curr.y = prev.y + (dy / dist) * segLen;
    }
  }
}
