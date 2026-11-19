import {
  FLOOR_SPACING,
  SHAFT_LEFT,
  SHAFT_RIGHT,
  SHAFT_WIDTH,
  WALL_WIDTH,
  WORLD_WIDTH,
  getBiomeById,
  getBiomeForFloor,
} from './constants';
import { drawSpaceMarine } from './marineSprite';
import type {
  BiomeTheme,
  ChaosEnemy,
  ChapterTheme,
  ComboState,
  FloatingBanner,
  ImperialPickup,
  Particle,
  Platform,
  Player,
} from './types';

export interface RenderContextState {
  player: Player;
  chapter: ChapterTheme;
  platforms: readonly Platform[];
  enemies: readonly ChaosEnemy[];
  pickups: readonly ImperialPickup[];
  particles: readonly Particle[];
  banners: readonly FloatingBanner[];
  combo: ComboState;
  cameraY: number;
  viewHeight: number;
  time: number;
  hurryLevel: number;
  scrollActive: boolean;
  shakeX: number;
  shakeY: number;
  hurryFlash: number;
}

const MIN_VIEW_HEIGHT = 660;

export class TowerRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  public viewWidth = WORLD_WIDTH;
  public viewHeight = 720;
  public worldOffsetX = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = ctx;
  }

  public resize(containerWidth: number, containerHeight: number): number {
    const safeW = Math.max(240, containerWidth);
    const safeH = Math.max(320, containerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    // Uniform scale: always fit the full 480px tower horizontally AND at least
    // MIN_VIEW_HEIGHT vertically while filling 100% of the viewport edge-to-edge.
    const scale = Math.min(safeW / WORLD_WIDTH, safeH / MIN_VIEW_HEIGHT);
    this.viewWidth = safeW / scale;
    this.viewHeight = safeH / scale;
    this.worldOffsetX = Math.max(0, (this.viewWidth - WORLD_WIDTH) / 2);

    this.canvas.width = Math.max(1, Math.round(safeW * dpr));
    this.canvas.height = Math.max(1, Math.round(safeH * dpr));
    this.canvas.style.width = `${safeW}px`;
    this.canvas.style.height = `${safeH}px`;

    this.ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    return this.viewHeight;
  }

  public render(state: RenderContextState): void {
    const ctx = this.ctx;
    const vw = this.viewWidth;
    const vh = this.viewHeight;

    const cameraCenterFloor = Math.max(0, Math.floor(-(state.cameraY + vh * 0.5) / FLOOR_SPACING));
    const biome = getBiomeForFloor(cameraCenterFloor);

    ctx.save();

    // 0. Full-bleed Gothic Fortress Buttress Wings (fills wide iPad/desktop viewports seamlessly)
    if (this.worldOffsetX > 0.5) {
      this.drawFortressWings(ctx, biome, state.cameraY, vw, vh, this.worldOffsetX, state.time);
    }

    // Center the exact 480px gameplay tower shaft inside the full-screen canvas
    ctx.save();
    ctx.translate(this.worldOffsetX, 0);

    // 1. Deep Gothic Sky / Spire Interior Backdrop
    this.drawBackdrop(ctx, biome, state.cameraY, vh, state.time);

    // Apply micro screen shake to world layer
    ctx.save();
    ctx.translate(state.shakeX, state.shakeY);

    // 2. Flanking Fortress Buttress Walls
    this.drawFortressWalls(ctx, biome, state.cameraY, vh, state.time);

    // 3. World Space Entities
    ctx.save();
    ctx.translate(0, -state.cameraY);

    this.drawPlatforms(ctx, state.platforms, state.cameraY, vh);
    this.drawPickups(ctx, state.pickups, state.cameraY, vh, state.time);
    this.drawEnemies(ctx, state.enemies, state.cameraY, vh, state.time);
    drawSpaceMarine(ctx, state.player, state.chapter, state.combo.active, state.time);
    this.drawParticles(ctx, state.particles);
    this.drawWorldBanners(ctx, state.banners);

    ctx.restore();

    // 4. Rising Warp-Fire / Promethium Purge edge hazard
    if (state.scrollActive) {
      this.drawRisingHazard(ctx, vh, state.hurryLevel, state.time);
    }

    ctx.restore(); // end shake

    // 5. Screen-Space Dramatic Banners (centered over the playable tower shaft)
    this.drawScreenBanners(ctx, state.banners, vh);

    ctx.restore(); // end worldOffsetX translate

    // 6. Full-screen Hurry-Up Crimson Pulse Overlay
    if (state.hurryFlash > 0) {
      ctx.fillStyle = `rgba(215, 36, 36, ${state.hurryFlash * 0.24})`;
      ctx.fillRect(0, 0, vw, vh);
    }

    ctx.restore();
  }

  private drawFortressWings(
    ctx: CanvasRenderingContext2D,
    biome: BiomeTheme,
    cameraY: number,
    vw: number,
    vh: number,
    wingW: number,
    time: number,
  ): void {
    // Deep armored backdrop across full screen
    const bg = ctx.createLinearGradient(0, 0, 0, vh);
    bg.addColorStop(0, biome.skyTop);
    bg.addColorStop(1, biome.skyBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, vw, vh);

    const rightStart = wingW + WORLD_WIDTH;
    const drawSide = (x: number, w: number, isRight: boolean): void => {
      if (w <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, 0, w, vh);
      ctx.clip();

      // Subtle darker armored cladding
      ctx.fillStyle = 'rgba(4, 7, 13, 0.48)';
      ctx.fillRect(x, 0, w, vh);

      // Vertical Gothic buttress columns
      const colStep = 92;
      ctx.fillStyle = biome.archColor;
      for (let cx = isRight ? x + 28 : x + w - 44; isRight ? cx < x + w : cx > x - 20; cx += isRight ? colStep : -colStep) {
        ctx.fillRect(cx, 0, 18, vh);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(cx + 2, 0, 3, vh);
        ctx.fillStyle = biome.archColor;
      }

      // Parallax horizontal masonry courses & pointed cathedral arches
      const courseH = 110;
      const offset = ((cameraY * 0.35) % courseH + courseH) % courseH;
      ctx.strokeStyle = biome.archHighlight;
      ctx.lineWidth = 2;
      for (let y = -offset - courseH; y < vh + courseH; y += courseH) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
        ctx.fillRect(x, y, w, 2);

        if (w > 64) {
          const archCenter = isRight ? x + Math.min(w * 0.5, 118) : x + w - Math.min(w * 0.5, 118);
          const halfSpan = Math.min(54, w * 0.36);
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.moveTo(archCenter - halfSpan, y + courseH);
          ctx.quadraticCurveTo(archCenter - halfSpan, y + 28, archCenter, y + 8);
          ctx.quadraticCurveTo(archCenter + halfSpan, y + 28, archCenter + halfSpan, y + courseH);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // Outer tower border trim + soft vignette shadow
      const seamX = isRight ? x : x + w - 2;
      ctx.fillStyle = biome.wallTrim;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(seamX, 0, 2, vh);
      ctx.globalAlpha = 1;

      const fade = ctx.createLinearGradient(
        isRight ? x : x + w,
        0,
        isRight ? x + w : x,
        0,
      );
      fade.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
      fade.addColorStop(0.65, 'rgba(0, 0, 0, 0.45)');
      fade.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
      ctx.fillStyle = fade;
      ctx.fillRect(x, 0, w, vh);

      // Subtle floating ambient embers in the fortress wings
      ctx.fillStyle = biome.ambientEmber;
      for (let i = 0; i < 6; i++) {
        const seed = (isRight ? 17 : 7) + i * 53.7;
        const ex = x + ((seed * 41) % Math.max(12, w - 12)) + 6;
        const ey = ((seed * 29 - cameraY * 0.3 - time * (12 + (i % 3) * 4)) % vh + vh) % vh;
        ctx.globalAlpha = 0.12 + 0.1 * Math.sin(time * 2 + seed);
        ctx.fillRect(ex, ey, 2, 2);
      }
      ctx.globalAlpha = 1;

      ctx.restore();
    };

    drawSide(0, wingW, false);
    drawSide(rightStart, vw - rightStart, true);
  }

  private drawBackdrop(
    ctx: CanvasRenderingContext2D,
    biome: BiomeTheme,
    cameraY: number,
    vh: number,
    time: number,
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, vh);
    grad.addColorStop(0, biome.skyTop);
    grad.addColorStop(1, biome.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_WIDTH, vh);

    const archPeriod = 220;
    const parallaxOffset = ((cameraY * 0.22) % archPeriod + archPeriod) % archPeriod;

    ctx.save();
    ctx.beginPath();
    ctx.rect(SHAFT_LEFT, 0, SHAFT_WIDTH, vh);
    ctx.clip();

    ctx.fillStyle = biome.archColor;
    ctx.fillRect(SHAFT_LEFT + 28, 0, 18, vh);
    ctx.fillRect(SHAFT_RIGHT - 46, 0, 18, vh);
    ctx.fillRect(WORLD_WIDTH / 2 - 12, 0, 24, vh);

    for (let y = -parallaxOffset - archPeriod; y < vh + archPeriod; y += archPeriod) {
      ctx.strokeStyle = biome.archHighlight;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(SHAFT_LEFT + 36, y + 140);
      ctx.quadraticCurveTo(SHAFT_LEFT + 36, y + 40, WORLD_WIDTH / 2, y);
      ctx.quadraticCurveTo(SHAFT_RIGHT - 36, y + 40, SHAFT_RIGHT - 36, y + 140);
      ctx.stroke();

      ctx.strokeStyle = biome.archHighlight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(WORLD_WIDTH / 2, y + 72, 26, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(WORLD_WIDTH / 2 - 26, y + 72);
      ctx.lineTo(WORLD_WIDTH / 2 + 26, y + 72);
      ctx.moveTo(WORLD_WIDTH / 2, y + 46);
      ctx.lineTo(WORLD_WIDTH / 2, y + 98);
      ctx.stroke();

      ctx.fillStyle =
        biome.id === 'fortress'
          ? 'rgba(42, 118, 224, 0.08)'
          : biome.id === 'mechanicus'
            ? 'rgba(220, 78, 36, 0.08)'
            : 'rgba(218, 174, 72, 0.05)';
      ctx.beginPath();
      ctx.arc(WORLD_WIDTH / 2, y + 72, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = biome.ambientEmber;
    for (let i = 0; i < 16; i++) {
      const seed = i * 97.3;
      const mx =
        SHAFT_LEFT + 20 + ((seed * 31) % (SHAFT_WIDTH - 40)) + Math.sin(time * 0.8 + i) * 10;
      const rawY = ((seed * 53 - cameraY * 0.45 - time * (16 + (i % 4) * 5)) % vh + vh) % vh;
      const alpha = 0.14 + 0.16 * Math.sin(time * 2.2 + i);
      ctx.globalAlpha = alpha;
      ctx.fillRect(mx, rawY, 2.2, 2.2);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private drawFortressWalls(
    ctx: CanvasRenderingContext2D,
    biome: BiomeTheme,
    cameraY: number,
    vh: number,
    time: number,
  ): void {
    ctx.fillStyle = biome.wallBase;
    ctx.fillRect(0, 0, WALL_WIDTH, vh);
    ctx.fillRect(SHAFT_RIGHT, 0, WALL_WIDTH, vh);

    const blockH = 88;
    const offset = ((cameraY % blockH) + blockH) % blockH;

    for (let y = -offset - blockH; y < vh + blockH; y += blockH) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fillRect(0, y, WALL_WIDTH, 3);
      ctx.fillRect(SHAFT_RIGHT, y, WALL_WIDTH, 3);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(2, y + 3, WALL_WIDTH - 5, 2);
      ctx.fillRect(SHAFT_RIGHT + 3, y + 3, WALL_WIDTH - 5, 2);

      ctx.fillStyle = biome.wallTrim;
      ctx.fillRect(8, y + 12, 3, 3);
      ctx.fillRect(21, y + 12, 3, 3);
      ctx.fillRect(8, y + blockH - 14, 3, 3);
      ctx.fillRect(21, y + blockH - 14, 3, 3);

      ctx.fillRect(SHAFT_RIGHT + 10, y + 12, 3, 3);
      ctx.fillRect(SHAFT_RIGHT + 23, y + 12, 3, 3);
      ctx.fillRect(SHAFT_RIGHT + 10, y + blockH - 14, 3, 3);
      ctx.fillRect(SHAFT_RIGHT + 23, y + blockH - 14, 3, 3);

      const blockIndex = Math.round((y + cameraY) / blockH);
      if (Math.abs(blockIndex) % 3 === 1) {
        const flicker = 0.78 + Math.sin(time * 12 + blockIndex) * 0.16;
        const glowY = y + blockH * 0.5;
        this.drawWallSconce(ctx, WALL_WIDTH - 2, glowY, 1, biome.ambientEmber, flicker);
        this.drawWallSconce(ctx, SHAFT_RIGHT + 2, glowY, -1, biome.ambientEmber, flicker);
      }
    }

    ctx.fillStyle = biome.wallTrim;
    ctx.fillRect(WALL_WIDTH - 4, 0, 3, vh);
    ctx.fillRect(SHAFT_RIGHT + 1, 0, 3, vh);

    const leftShadow = ctx.createLinearGradient(SHAFT_LEFT, 0, SHAFT_LEFT + 18, 0);
    leftShadow.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
    leftShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leftShadow;
    ctx.fillRect(SHAFT_LEFT, 0, 18, vh);

    const rightShadow = ctx.createLinearGradient(SHAFT_RIGHT, 0, SHAFT_RIGHT - 18, 0);
    rightShadow.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
    rightShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rightShadow;
    ctx.fillRect(SHAFT_RIGHT - 18, 0, 18, vh);
  }

  private drawWallSconce(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dir: 1 | -1,
    emberColor: string,
    flicker: number,
  ): void {
    ctx.save();
    const grad = ctx.createRadialGradient(x + dir * 4, y, 2, x + dir * 4, y, 32 * flicker);
    grad.addColorStop(0, emberColor);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.34 * flicker;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x + dir * 4, y, 32 * flicker, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#151922';
    ctx.fillRect(dir > 0 ? x - 6 : x - 2, y - 3, 8, 6);
    ctx.fillStyle = '#fff0b3';
    ctx.beginPath();
    ctx.arc(x + dir * 3, y - 3, 2.5 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlatforms(
    ctx: CanvasRenderingContext2D,
    platforms: readonly Platform[],
    cameraY: number,
    vh: number,
  ): void {
    const minVisibleY = cameraY - 40;
    const maxVisibleY = cameraY + vh + 40;

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (p.y < minVisibleY || p.y > maxVisibleY) continue;

      const theme = getBiomeById(p.biomeId);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(p.x + 2, p.y + p.height, p.width - 4, 5);

      ctx.fillStyle = theme.platformBody;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.width, p.height, 3);
      ctx.fill();

      ctx.fillStyle = theme.platformTop;
      ctx.beginPath();
      ctx.roundRect(p.x + 1, p.y, p.width - 2, 6, [3, 3, 0, 0]);
      ctx.fill();

      if (p.landFlash > 0) {
        ctx.fillStyle = `rgba(255, 226, 130, ${p.landFlash * 1.6})`;
        ctx.fillRect(p.x + 2, p.y, p.width - 4, 5);
      }

      ctx.strokeStyle = theme.platformBorder;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.width, p.height, 3);
      ctx.stroke();

      ctx.fillStyle = theme.platformAccent;
      ctx.fillRect(p.x + 3, p.y + 7, 5, p.height - 10);
      ctx.fillRect(p.x + p.width - 8, p.y + 7, 5, p.height - 10);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      for (let gx = p.x + 18; gx < p.x + p.width - 22; gx += 18) {
        ctx.fillRect(gx, p.y + 9, 8, 4);
      }

      if (p.isMilestone) {
        this.drawMilestonePlaque(ctx, p, theme);
      }
    }
  }

  private drawMilestonePlaque(
    ctx: CanvasRenderingContext2D,
    p: Platform,
    theme: BiomeTheme,
  ): void {
    const centerX = p.x + p.width / 2;
    const label = p.floor === 0 ? 'BASTION GROUND' : `FLOOR ${p.floor}`;

    ctx.fillStyle = theme.platformAccent;
    ctx.fillRect(p.x + 1, p.y, p.width - 2, 2.5);

    const plaqueW = p.floor === 0 ? 124 : 84;
    const plaqueH = 18;
    const px = centerX - plaqueW / 2;
    const py = p.y + 1;

    ctx.fillStyle = '#141924';
    ctx.strokeStyle = theme.platformAccent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(px, py, plaqueW, plaqueH, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f5dc93';
    ctx.font = '700 10.5px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, centerX, py + plaqueH / 2 + 0.5);
  }

  private drawPickups(
    ctx: CanvasRenderingContext2D,
    pickups: readonly ImperialPickup[],
    cameraY: number,
    vh: number,
    time: number,
  ): void {
    const minY = cameraY - 40;
    const maxY = cameraY + vh + 40;

    for (let i = 0; i < pickups.length; i++) {
      const item = pickups[i];
      if (item.collected || item.y < minY || item.y > maxY) continue;

      const bob = Math.sin(time * 4.2 + item.phase) * 4;
      const x = item.x;
      const y = item.y + bob;

      ctx.save();
      ctx.translate(x, y);

      if (item.kind === 'seal') {
        // Purity Seal Relic (soft gold glow + crimson wax + parchment strips)
        const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
        aura.addColorStop(0, 'rgba(245, 206, 102, 0.45)');
        aura.addColorStop(1, 'rgba(245, 206, 102, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        // Twin parchment scrolls
        ctx.fillStyle = '#f2e4c4';
        ctx.strokeStyle = '#6b4d2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-5, -2, 5, 13, 1);
        ctx.roundRect(0.5, -1, 5, 11, 1);
        ctx.fill();
        ctx.stroke();

        // Wax seal stamp
        ctx.fillStyle = '#c4232c';
        ctx.beginPath();
        ctx.arc(0, -4, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#630c12';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = '#f2d074';
        ctx.fillRect(-1.5, -5.5, 3, 3);
      } else if (item.kind === 'halo') {
        // Iron Halo Relic (rotating golden starburst ring)
        const aura = ctx.createRadialGradient(0, 0, 3, 0, 0, 22);
        aura.addColorStop(0, 'rgba(255, 226, 112, 0.65)');
        aura.addColorStop(1, 'rgba(255, 210, 72, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.rotate(time * 1.8);
        ctx.strokeStyle = '#f7d568';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
        ctx.stroke();

        // 8 Iron Halo spikes
        ctx.strokeStyle = '#fff3be';
        ctx.lineWidth = 1.6;
        for (let s = 0; s < 8; s++) {
          const a = (Math.PI * 2 * s) / 8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 9.5, Math.sin(a) * 9.5);
          ctx.lineTo(Math.cos(a) * 14.5, Math.sin(a) * 14.5);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Jump-Pack Overcharge Plasma Cell (pulsing cyan/gold core)
        const aura = ctx.createRadialGradient(0, 0, 3, 0, 0, 23);
        aura.addColorStop(0, 'rgba(92, 224, 255, 0.7)');
        aura.addColorStop(1, 'rgba(92, 224, 255, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 23, 0, Math.PI * 2);
        ctx.fill();

        // Armored promethium cell canister
        ctx.fillStyle = '#1f2b3d';
        ctx.strokeStyle = '#e5ba4b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-7, -10, 14, 20, 3);
        ctx.fill();
        ctx.stroke();

        // Glowing plasma coils inside
        ctx.fillStyle = '#6be6ff';
        ctx.fillRect(-4, -6, 8, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -4, 4, 8);

        // Upward thruster chevrons
        ctx.strokeStyle = '#ffe580';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-4, -13);
        ctx.lineTo(0, -17);
        ctx.lineTo(4, -13);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawEnemies(
    ctx: CanvasRenderingContext2D,
    enemies: readonly ChaosEnemy[],
    cameraY: number,
    vh: number,
    time: number,
  ): void {
    const minY = cameraY - 50;
    const maxY = cameraY + vh + 50;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || e.y < minY || e.y > maxY) continue;

      if (e.kind === 'heretic') {
        this.drawChaosHeretic(ctx, e, time);
      } else {
        this.drawBlightDrone(ctx, e, time);
      }
    }
  }

  private drawChaosHeretic(ctx: CanvasRenderingContext2D, e: ChaosEnemy, time: number): void {
    const cx = e.x + e.width / 2;
    const bottomY = e.y + e.height;
    const facing = e.vx >= 0 ? 1 : -1;
    const step = Math.sin(time * 11 + e.phase) * 2.4;

    ctx.save();
    ctx.translate(cx, bottomY);
    ctx.scale(facing, 1);

    // Subtle dark crimson threat aura
    const aura = ctx.createRadialGradient(0, -15, 4, 0, -15, 20);
    aura.addColorStop(0, 'rgba(210, 32, 46, 0.28)');
    aura.addColorStop(1, 'rgba(210, 32, 46, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -15, 20, 0, Math.PI * 2);
    ctx.fill();

    // Boots
    ctx.fillStyle = '#1d1518';
    ctx.fillRect(-7 + step, -5, 6, 5);
    ctx.fillRect(2 - step, -5, 6, 5);

    // Tattered Chaos Cultist Robes
    ctx.fillStyle = '#5c141d';
    ctx.strokeStyle = '#140608';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-8, -22);
    ctx.lineTo(8, -22);
    ctx.lineTo(10, -4);
    ctx.lineTo(4, -7);
    ctx.lineTo(0, -3);
    ctx.lineTo(-4, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Brass Chaos armor strap
    ctx.strokeStyle = '#b88332';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-6, -21);
    ctx.lineTo(6, -10);
    ctx.stroke();

    // Spiked Chaos Hood / Mask
    ctx.fillStyle = '#3a0d14';
    ctx.beginPath();
    ctx.moveTo(-8, -21);
    ctx.lineTo(0, -33);
    ctx.lineTo(8, -21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Twin Chaos horns on hood
    ctx.strokeStyle = '#c49645';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-5, -26);
    ctx.lineTo(-10, -32);
    ctx.moveTo(5, -26);
    ctx.lineTo(10, -32);
    ctx.stroke();

    // Glowing sickly warp-green eyes
    ctx.fillStyle = '#62ff7a';
    ctx.fillRect(1, -24, 2.8, 2.2);
    ctx.fillRect(4.8, -24, 2.2, 2);

    ctx.restore();
  }

  private drawBlightDrone(ctx: CanvasRenderingContext2D, e: ChaosEnemy, time: number): void {
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    const facing = e.vx >= 0 ? 1 : -1;

    ctx.save();
    ctx.translate(cx, cy);

    // Warp-green hover glow
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 22);
    glow.addColorStop(0, 'rgba(84, 240, 118, 0.34)');
    glow.addColorStop(1, 'rgba(84, 240, 118, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    // Whirring side turbine blades
    const rotorW = 5 + Math.abs(Math.sin(time * 28)) * 5;
    ctx.fillStyle = '#8a949e';
    ctx.fillRect(-17 - rotorW * 0.5, -2, rotorW, 4);
    ctx.fillRect(17 - rotorW * 0.5, -2, rotorW, 4);

    // Corroded iron-brass armored carapace
    ctx.fillStyle = '#3c4532';
    ctx.strokeStyle = '#11140d';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Brass Chaos trim ring + spikes
    ctx.strokeStyle = '#b58438';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#c49442';
    ctx.beginPath();
    ctx.moveTo(-4, -11);
    ctx.lineTo(0, -16);
    ctx.lineTo(4, -11);
    ctx.fill();

    // Glowing Cyclops Warp Lens
    ctx.save();
    ctx.shadowColor = '#54ff76';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#6dff89';
    ctx.beginPath();
    ctx.arc(facing * 3.5, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(facing * 4.5, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, particles: readonly Particle[]): void {
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;

      if (pt.shape === 'ring') {
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 2.5 * alpha;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, pt.size, pt.size * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (pt.shape === 'spark') {
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = Math.max(1.2, pt.size * 0.65);
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - pt.vx * 0.028, pt.y - pt.vy * 0.028);
        ctx.stroke();
      } else if (pt.shape === 'ember') {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }

      ctx.restore();
    }
  }

  private drawRisingHazard(
    ctx: CanvasRenderingContext2D,
    vh: number,
    hurryLevel: number,
    time: number,
  ): void {
    const height = 34 + hurryLevel * 7;
    const grad = ctx.createLinearGradient(0, vh - height, 0, vh);
    grad.addColorStop(0, 'rgba(210, 44, 24, 0)');
    grad.addColorStop(0.65, `rgba(210, 48, 22, ${0.22 + hurryLevel * 0.045})`);
    grad.addColorStop(1, `rgba(255, 118, 36, ${0.52 + hurryLevel * 0.06})`);

    ctx.fillStyle = grad;
    ctx.fillRect(SHAFT_LEFT, vh - height, SHAFT_WIDTH, height);

    ctx.save();
    ctx.fillStyle = 'rgba(255, 174, 66, 0.5)';
    for (let x = SHAFT_LEFT; x < SHAFT_RIGHT; x += 26) {
      const wave = Math.sin(time * 9 + x * 0.14) * 6;
      const flameH = 9 + hurryLevel * 2 + wave;
      ctx.beginPath();
      ctx.moveTo(x, vh);
      ctx.lineTo(x + 13, vh - Math.max(4, flameH));
      ctx.lineTo(x + 26, vh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawWorldBanners(ctx: CanvasRenderingContext2D, banners: readonly FloatingBanner[]): void {
    for (const b of banners) {
      if (b.isScreenSpace) continue;
      const progress = 1 - b.life / b.maxLife;
      const alpha = progress < 0.7 ? 1 : Math.max(0, (1 - progress) / 0.3);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = `800 ${Math.round(15 * b.scale)}px "Cinzel", Georgia, serif`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(8, 12, 22, 0.9)';
      ctx.strokeText(b.text, b.x, b.y);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, b.x, b.y);

      if (b.subtext) {
        ctx.font = '700 11px "Share Tech Mono", monospace';
        ctx.strokeText(b.subtext, b.x, b.y + 16);
        ctx.fillStyle = '#f5f7fc';
        ctx.fillText(b.subtext, b.x, b.y + 16);
      }

      ctx.restore();
    }
  }

  private drawScreenBanners(
    ctx: CanvasRenderingContext2D,
    banners: readonly FloatingBanner[],
    vh: number,
  ): void {
    for (const b of banners) {
      if (!b.isScreenSpace) continue;
      const progress = 1 - b.life / b.maxLife;
      const pop = progress < 0.12 ? 0.75 + (progress / 0.12) * 0.3 : 1;
      const alpha = progress < 0.72 ? 1 : Math.max(0, (1 - progress) / 0.28);

      const x = WORLD_WIDTH * b.x;
      const y = vh * b.y;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = `800 ${Math.round(22 * b.scale)}px "Cinzel", Georgia, serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(6, 10, 18, 0.94)';
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);

      if (b.subtext) {
        ctx.font = '700 13px "Share Tech Mono", monospace';
        ctx.lineWidth = 3.5;
        ctx.strokeText(b.subtext, 0, 24);
        ctx.fillStyle = '#eef3fc';
        ctx.fillText(b.subtext, 0, 24);
      }

      ctx.restore();
    }
  }
}
