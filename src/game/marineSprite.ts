import type { ChapterTheme, Player } from './types';

/**
 * Draws a detailed Warhammer 40k Space Marine (Mk X / Mk VII silhouette)
 * themed to the selected Chapter, with Iron Halo shield, Overcharge thrusters,
 * and flowing purity seal ribbon.
 */
export function drawSpaceMarine(
  ctx: CanvasRenderingContext2D,
  player: Player,
  chapter: ChapterTheme,
  comboActive: boolean,
  time: number,
): void {
  // Subtle post-hit invulnerability flicker
  if (player.invulnTimer > 0 && Math.floor(time * 20) % 2 === 0) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawMarineBody(ctx, player, chapter, comboActive, time);
    ctx.restore();
    return;
  }

  drawMarineBody(ctx, player, chapter, comboActive, time);
}

function drawMarineBody(
  ctx: CanvasRenderingContext2D,
  player: Player,
  chapter: ChapterTheme,
  comboActive: boolean,
  time: number,
): void {
  drawPuritySeal(ctx, player);

  const cx = player.x + player.width / 2;
  const bottomY = player.y + player.height;
  const midY = player.y + player.height * 0.5;
  const isOvercharged = player.overchargeTimer > 0;

  ctx.save();

  if (player.isSpinning) {
    ctx.translate(cx, midY);

    ctx.save();
    ctx.strokeStyle = isOvercharged
      ? 'rgba(255, 224, 110, 0.85)'
      : comboActive
        ? 'rgba(255, 214, 92, 0.55)'
        : `${chapter.thrusterCore}88`;
    ctx.lineWidth = isOvercharged ? 3.5 : 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, isOvercharged ? 30 : 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.rotate(player.spinAngle);
    ctx.scale(player.facing, 1);
    ctx.translate(0, player.height * 0.5);
  } else {
    ctx.translate(cx, bottomY);
    const scaleX = (1 / Math.sqrt(player.squashY)) * player.facing;
    const scaleY = player.squashY;
    ctx.scale(scaleX, scaleY);

    const lean = Math.max(-0.18, Math.min(0.18, (player.vx * player.facing) / 2400));
    ctx.rotate(lean);
  }

  // Contact shadow on platform when grounded
  if (player.grounded) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const running = player.grounded && Math.abs(player.vx) > 25;
  const stride = running ? Math.sin(player.runCycle * 1.9) : 0;
  const airborne = !player.grounded;
  const breath = player.grounded && !running ? Math.sin(time * 3.4) * 0.7 : 0;

  // 1. JUMP PACK / POWER BACKPACK
  drawJumpPack(ctx, player, chapter, airborne, comboActive, isOvercharged, time, breath);

  // 2. BACK LEG
  const backLegAngle = airborne ? 0.35 : -stride * 0.55;
  drawLeg(ctx, chapter, -4, -17 + breath, backLegAngle, true);

  // 3. BACK ARM
  ctx.save();
  ctx.translate(5, -31 + breath);
  ctx.rotate(airborne ? -0.55 : stride * 0.5);
  ctx.fillStyle = chapter.armorDark;
  ctx.fillRect(-3, 0, 7, 13);
  ctx.fillStyle = chapter.armorMid;
  ctx.fillRect(-3.5, 9, 8, 6);
  ctx.restore();

  // 4. TORSO / CUIRASS
  ctx.save();
  ctx.translate(0, breath);

  ctx.fillStyle = '#1b202b';
  ctx.fillRect(-9, -22, 18, 6);
  ctx.fillStyle = '#2c221b';
  ctx.fillRect(-10, -21, 20, 4);
  ctx.fillStyle = chapter.trim;
  ctx.fillRect(-2, -21.5, 6, 5);

  const chestGrad = ctx.createLinearGradient(-11, -37, 12, -21);
  chestGrad.addColorStop(0, chapter.armorDark);
  chestGrad.addColorStop(0.55, chapter.armorMid);
  chestGrad.addColorStop(1, chapter.armorLight);
  ctx.fillStyle = chestGrad;
  ctx.beginPath();
  ctx.roundRect(-11, -37, 22, 17, 4);
  ctx.fill();
  ctx.strokeStyle = '#09111f';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Gorget collar
  ctx.fillStyle = chapter.armorMid;
  ctx.fillRect(-8, -39, 16, 4);
  ctx.strokeStyle = chapter.trim;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-7, -37);
  ctx.lineTo(7, -37);
  ctx.stroke();

  // Imperial Aquila chest emblem
  ctx.fillStyle = chapter.trim;
  ctx.beginPath();
  ctx.moveTo(2, -31);
  ctx.lineTo(10, -34);
  ctx.lineTo(9, -31);
  ctx.lineTo(10, -29);
  ctx.lineTo(2, -28);
  ctx.lineTo(-5, -29);
  ctx.lineTo(-4, -31);
  ctx.lineTo(-5, -34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(0.5, -31.5, 3, 3.5);

  ctx.restore();

  // 5. FRONT LEG
  const frontLegAngle = airborne ? -0.45 : stride * 0.55;
  drawLeg(ctx, chapter, 3, -17 + breath, frontLegAngle, false);

  // 6. HELMET
  drawHelmet(ctx, chapter, breath, comboActive || isOvercharged, time);

  // 7. FRONT ARM & CHAPTER PAULDRON
  ctx.save();
  ctx.translate(-3, -32 + breath);
  ctx.rotate(airborne ? -0.4 : -stride * 0.45);

  ctx.fillStyle = chapter.armorMid;
  ctx.strokeStyle = '#09111f';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.roundRect(-5, 4, 8.5, 12, 2.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = chapter.trim;
  ctx.fillRect(-5, 11, 8.5, 2.2);

  // Oversized Curved Pauldron
  const pauldronGrad = ctx.createLinearGradient(-11, -7, 8, 9);
  pauldronGrad.addColorStop(0, chapter.armorLight);
  pauldronGrad.addColorStop(0.55, chapter.armorMid);
  pauldronGrad.addColorStop(1, chapter.armorDark);
  ctx.fillStyle = pauldronGrad;
  ctx.beginPath();
  ctx.ellipse(-1, 1, 9.5, 8.5, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = chapter.trim;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = '#09111f';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(-1, 1, 10.6, 9.5, -0.1, 0, Math.PI * 2);
  ctx.stroke();

  drawChapterEmblem(ctx, chapter);

  ctx.restore();

  ctx.restore();

  // 8. IRON HALO GOLDEN ENERGY SHIELD AURA (World space around Marine)
  if (player.hasIronHalo) {
    drawIronHaloAura(ctx, cx, midY, time);
  }
}

function drawChapterEmblem(ctx: CanvasRenderingContext2D, chapter: ChapterTheme): void {
  ctx.save();
  if (chapter.id === 'ultramarines') {
    // White Ultima (Inverted Omega)
    ctx.strokeStyle = chapter.emblemColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-1, 1.8, 3.6, 0.15 * Math.PI, 0.85 * Math.PI, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4.4, 2.2);
    ctx.lineTo(-4.4, -2.2);
    ctx.lineTo(-2.4, -2.2);
    ctx.moveTo(2.4, 2.2);
    ctx.lineTo(2.4, -2.2);
    ctx.lineTo(0.4, -2.2);
    ctx.stroke();
  } else if (chapter.id === 'blood_angels') {
    // Black wings + crimson/gold blood drop
    ctx.fillStyle = chapter.emblemColor;
    ctx.beginPath();
    ctx.moveTo(-1, 1);
    ctx.lineTo(-6, -2.5);
    ctx.lineTo(-5, 2.5);
    ctx.lineTo(-1, 2);
    ctx.lineTo(3, 2.5);
    ctx.lineTo(4, -2.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5d264';
    ctx.beginPath();
    ctx.moveTo(-1, -3);
    ctx.quadraticCurveTo(1.5, 1.5, -1, 4.2);
    ctx.quadraticCurveTo(-3.5, 1.5, -1, -3);
    ctx.fill();
  } else if (chapter.id === 'salamanders') {
    // Stylized white/orange Nocturne flame crest
    ctx.fillStyle = chapter.emblemColor;
    ctx.beginPath();
    ctx.moveTo(-1, -3.5);
    ctx.quadraticCurveTo(3.5, 0.5, 1.5, 4);
    ctx.lineTo(-1, 2.2);
    ctx.lineTo(-3.5, 4);
    ctx.quadraticCurveTo(-5.5, 0.5, -1, -3.5);
    ctx.fill();
  } else if (chapter.id === 'imperial_fists') {
    // White roundel with black gauntlet fist
    ctx.fillStyle = '#f7f5ed';
    ctx.beginPath();
    ctx.arc(-1, 1, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = chapter.emblemColor;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = chapter.emblemColor;
    ctx.fillRect(-3.2, -1.2, 4.4, 4.2);
    ctx.fillRect(-3.8, 0.4, 1.2, 2.2);
  } else {
    // Dark Angels Winged Sword
    ctx.strokeStyle = chapter.emblemColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-1, -3.5);
    ctx.lineTo(-1, 4.8);
    ctx.moveTo(-3.8, -1.2);
    ctx.lineTo(1.8, -1.2);
    ctx.stroke();
    ctx.fillStyle = chapter.emblemColor;
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-5.8, -1.8);
    ctx.lineTo(-4.6, 2.2);
    ctx.moveTo(-1, 0);
    ctx.lineTo(3.8, -1.8);
    ctx.lineTo(2.6, 2.2);
    ctx.fill();
  }
  ctx.restore();
}

function drawIronHaloAura(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);

  const pulse = 0.88 + Math.sin(time * 7) * 0.12;
  const grad = ctx.createRadialGradient(0, 0, 18, 0, 0, 31 * pulse);
  grad.addColorStop(0, 'rgba(255, 224, 110, 0)');
  grad.addColorStop(0.72, 'rgba(255, 214, 88, 0.14)');
  grad.addColorStop(1, 'rgba(255, 232, 138, 0.48)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 31 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Rotating sacred Iron Halo ring
  ctx.rotate(time * 1.4);
  ctx.strokeStyle = 'rgba(247, 214, 106, 0.85)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, 29, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 4 cardinal starburst spikes
  ctx.fillStyle = '#fff2b3';
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 29, Math.sin(a) * 29, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawJumpPack(
  ctx: CanvasRenderingContext2D,
  player: Player,
  chapter: ChapterTheme,
  airborne: boolean,
  comboActive: boolean,
  isOvercharged: boolean,
  time: number,
  breath: number,
): void {
  ctx.save();
  ctx.translate(-12, -31 + breath);

  ctx.fillStyle = chapter.armorDark;
  ctx.strokeStyle = '#08101c';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.roundRect(-6, -9, 10, 19, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = chapter.armorMid;
  ctx.beginPath();
  ctx.arc(-3, -9, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = chapter.trim;
  ctx.fillRect(-5, -5, 6, 3);
  ctx.fillStyle = '#47556e';
  ctx.fillRect(-5, 6, 7, 4);

  const firing =
    isOvercharged ||
    player.thrusterTimer > 0 ||
    player.isSpinning ||
    (airborne && player.vy < -180);
  if (firing) {
    const intensity = isOvercharged ? 2.1 : player.isSpinning || comboActive ? 1.35 : 0.9;
    const flicker = 0.82 + Math.sin(time * 55) * 0.22;
    const flameLen = (13 + (player.thrusterTimer > 0 ? 10 : 0)) * intensity * flicker;

    const grad = ctx.createLinearGradient(-2, 10, -2, 10 + flameLen);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(
      0.35,
      isOvercharged ? '#ffe680' : comboActive ? chapter.thrusterCombo : chapter.thrusterCore,
    );
    grad.addColorStop(1, 'rgba(36, 132, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-6, 10);
    ctx.lineTo(2, 10);
    ctx.lineTo(-2, 10 + flameLen);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  chapter: ChapterTheme,
  hipX: number,
  hipY: number,
  angle: number,
  isBack: boolean,
): void {
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(angle);

  ctx.fillStyle = isBack ? chapter.armorDark : chapter.armorMid;
  ctx.strokeStyle = '#08101c';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-4.5, -1, 9, 10, 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isBack ? chapter.armorDark : chapter.armorLight;
  ctx.beginPath();
  ctx.moveTo(-5, 7);
  ctx.lineTo(5, 7);
  ctx.lineTo(6.5, 16);
  ctx.lineTo(-5.5, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isBack) {
    ctx.fillStyle = chapter.trim;
    ctx.fillRect(-1.5, 6.5, 3.5, 2.5);
  }

  ctx.fillStyle = isBack ? chapter.armorDark : chapter.armorMid;
  ctx.beginPath();
  ctx.roundRect(-5.5, 13, 13, 4.5, 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawHelmet(
  ctx: CanvasRenderingContext2D,
  chapter: ChapterTheme,
  breath: number,
  hasCrest: boolean,
  time: number,
): void {
  ctx.save();
  ctx.translate(1, -43 + breath);

  if (hasCrest) {
    const wave = Math.sin(time * 18) * 1.4;
    ctx.fillStyle = chapter.crestColor;
    ctx.strokeStyle = '#240b0e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.quadraticCurveTo(-1, -15 + wave, 6, -9);
    ctx.lineTo(4, -5);
    ctx.lineTo(-6, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = chapter.trim;
    ctx.fillRect(-5, -7.5, 9, 2.5);
  }

  const helmGrad = ctx.createLinearGradient(-7, -7, 8, 6);
  helmGrad.addColorStop(0, chapter.armorLight);
  helmGrad.addColorStop(0.6, chapter.armorMid);
  helmGrad.addColorStop(1, chapter.armorDark);
  ctx.fillStyle = helmGrad;
  ctx.strokeStyle = '#09111f';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = chapter.trim;
  ctx.fillRect(1, -5.5, 2.6, 2.6);

  ctx.fillStyle = '#182438';
  ctx.beginPath();
  ctx.moveTo(2, -1);
  ctx.lineTo(8.2, 1.5);
  ctx.lineTo(7.4, 5.5);
  ctx.lineTo(1.5, 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#6c7c96';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(4.2, 2);
  ctx.lineTo(4.2, 4.8);
  ctx.moveTo(6.1, 2.2);
  ctx.lineTo(6.1, 4.8);
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = chapter.eyeGlow;
  ctx.shadowBlur = hasCrest ? 9 : 5;
  ctx.fillStyle = chapter.eyeColor;
  ctx.beginPath();
  ctx.moveTo(1.8, -1.6);
  ctx.lineTo(7.2, -0.8);
  ctx.lineTo(6.4, 1.1);
  ctx.lineTo(2.2, 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(3.2, -1.1, 2, 0.8);
  ctx.restore();

  ctx.restore();
}

function drawPuritySeal(ctx: CanvasRenderingContext2D, player: Player): void {
  const trail = player.sealTrail;
  if (trail.length < 2) return;

  ctx.save();
  ctx.strokeStyle = '#e8d8b5';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(trail[0].x, trail[0].y);
  for (let i = 1; i < trail.length; i++) {
    ctx.lineTo(trail[i].x, trail[i].y);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(55, 36, 20, 0.55)';
  ctx.lineWidth = 1;
  ctx.setLineDash([1.5, 2.2]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#b51d29';
  ctx.beginPath();
  ctx.arc(trail[0].x, trail[0].y, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5e0a12';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.restore();
}
