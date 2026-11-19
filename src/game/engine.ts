import { getChapterTheme } from './chapters';
import {
  FIXED_DT,
  FLOOR_SPACING,
  HURRY_CALLOUTS,
  HURRY_INTERVAL_SECONDS,
  HURRY_SCROLL_SPEEDS,
  MAX_FRAME_DT,
  MAX_HURRY_LEVEL,
  SCROLL_START_FLOOR,
  SHAFT_LEFT,
  SHAFT_RIGHT,
  getBiomeForFloor,
} from './constants';
import {
  createComboState,
  finishCombo,
  registerFloorLanding,
  tickCombo,
  type ComboEvent,
} from './combo';
import { HazardManager } from './hazards';
import { InputManager } from './input';
import { ParticleSystem } from './particles';
import { createPlayer, stepPlayerPhysics } from './physics';
import { PlatformManager } from './platformGenerator';
import { TowerRenderer } from './renderer';
import { SoundEngine } from './sound';
import { loadRecords, saveRecords } from './storage';
import type {
  BiomeId,
  ChapterId,
  ComboState,
  GamePhase,
  HudSnapshot,
  PersistedRecords,
  Player,
} from './types';

export class GameEngine {
  private readonly renderer: TowerRenderer;
  private readonly input: InputManager;
  private readonly sound: SoundEngine;
  private readonly onHudUpdate: (snapshot: HudSnapshot) => void;

  private platformMgr = new PlatformManager();
  private hazardMgr = new HazardManager();
  private particles = new ParticleSystem();
  private player: Player = createPlayer();
  private combo: ComboState = createComboState();
  private records: PersistedRecords = loadRecords();

  private chapterId: ChapterId;
  private autoJump: boolean;
  private phase: GamePhase = 'title';
  private cameraY = -620;
  private time = 0;
  private accumulator = 0;
  private lastTimestamp = 0;
  private rafId: number | null = null;

  private bonusScore = 0;
  private runPurges = 0;
  private runBestCombo = 0;
  private isNewBestScore = false;
  private currentBiomeId: BiomeId = 'underhive';

  private scrollActive = false;
  private hurryLevel = 0;
  private hurryTimer = 0;
  private hurryFlash = 0;

  private shakeMagnitude = 0;
  private shakeX = 0;
  private shakeY = 0;
  private spinTrailTimer = 0;
  private hudEmitCounter = 0;

  constructor(
    renderer: TowerRenderer,
    input: InputManager,
    sound: SoundEngine,
    initialChapter: ChapterId,
    initialAutoJump: boolean,
    onHudUpdate: (snapshot: HudSnapshot) => void,
  ) {
    this.renderer = renderer;
    this.input = input;
    this.sound = sound;
    this.chapterId = initialChapter;
    this.autoJump = initialAutoJump;
    this.onHudUpdate = onHudUpdate;

    this.resetWorld();
    this.emitHud();
  }

  public getPhase(): GamePhase {
    return this.phase;
  }

  public setChapter(chapter: ChapterId): void {
    this.chapterId = chapter;
    this.emitHud();
  }

  public setAutoJump(enabled: boolean): void {
    this.autoJump = enabled;
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number): void => {
      const rawDt = Math.max(0, (now - this.lastTimestamp) / 1000);
      this.lastTimestamp = now;
      const frameDt = Math.min(MAX_FRAME_DT, rawDt);

      this.update(frameDt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public resize(width: number, height: number): void {
    this.renderer.resize(width, height);
    if (this.phase === 'title') {
      this.cameraY = -(this.renderer.viewHeight - 132);
    }
  }

  public startGame(): void {
    this.sound.unlock();
    this.input.clearAll();
    this.resetWorld();
    this.phase = 'playing';
    this.emitHud();
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.input.clearAll();
    this.emitHud();
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.sound.unlock();
    this.phase = 'playing';
    this.lastTimestamp = performance.now();
    this.emitHud();
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.pauseGame();
    } else if (this.phase === 'paused') {
      this.resumeGame();
    }
  }

  public returnToTitle(): void {
    this.input.clearAll();
    this.resetWorld();
    this.phase = 'title';
    this.emitHud();
  }

  private resetWorld(): void {
    this.platformMgr.reset();
    this.hazardMgr.reset();
    this.hazardMgr.populateForPlatforms(this.platformMgr.platforms);
    this.particles.reset();
    this.player = createPlayer();
    this.combo = createComboState();
    this.bonusScore = 0;
    this.runPurges = 0;
    this.runBestCombo = 0;
    this.isNewBestScore = false;
    this.currentBiomeId = 'underhive';
    this.scrollActive = false;
    this.hurryLevel = 0;
    this.hurryTimer = 0;
    this.hurryFlash = 0;
    this.shakeMagnitude = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.accumulator = 0;
    this.cameraY = -(this.renderer.viewHeight - 132);
  }

  private update(frameDt: number): void {
    if (this.phase === 'paused') {
      return;
    }

    this.time += frameDt;

    if (this.phase === 'title' || this.phase === 'gameover') {
      this.particles.update(frameDt);
      this.updateShake(frameDt);
      return;
    }

    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 4) {
      this.stepSimulation(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
      if (this.phase !== 'playing') break;
    }

    this.hudEmitCounter++;
    if (this.hudEmitCounter >= 3) {
      this.hudEmitCounter = 0;
      this.emitHud();
    }
  }

  private stepSimulation(dt: number): void {
    const input = this.input.pollInput();
    const chapter = getChapterTheme(this.chapterId);

    for (let i = 0; i < this.platformMgr.platforms.length; i++) {
      const p = this.platformMgr.platforms[i];
      if (p.landFlash > 0) {
        p.landFlash = Math.max(0, p.landFlash - dt);
      }
    }

    const phys = stepPlayerPhysics(
      this.player,
      input,
      this.platformMgr.platforms,
      dt,
      this.autoJump,
    );

    // Update Chaos patrols & resolve combat/relic interactions
    this.hazardMgr.update(dt, this.time);
    const hazardEv = this.hazardMgr.resolvePlayerInteractions(this.player);

    // Process Relic Pickups
    for (const item of hazardEv.collectedPickups) {
      this.bonusScore += item.points;
      this.sound.playPickup(item.pickup.kind);

      if (item.pickup.kind === 'seal') {
        if (this.combo.active) {
          this.combo.timer = this.combo.maxTimer;
        }
        this.particles.spawnRelicBurst(item.pickup.x, item.pickup.y, '#f5cf67');
        this.particles.spawnWorldBanner(
          'PURITY SEAL',
          item.pickup.x,
          item.pickup.y - 12,
          '#f5cf67',
          `+${item.points} PTS`,
          0.92,
        );
      } else if (item.pickup.kind === 'halo') {
        this.particles.spawnRelicBurst(item.pickup.x, item.pickup.y, '#ffe580');
        this.particles.spawnWorldBanner(
          item.grantedHalo ? 'IRON HALO' : 'HALO BLESSING',
          item.pickup.x,
          item.pickup.y - 14,
          '#ffe580',
          item.grantedHalo ? 'SHIELD ACTIVE' : `+${item.points} PTS`,
          1.0,
        );
      } else if (item.pickup.kind === 'overcharge') {
        this.particles.spawnRelicBurst(item.pickup.x, item.pickup.y, '#6be6ff');
        this.particles.spawnScreenBanner(
          'JUMP PACK OVERCHARGE!',
          '#6be6ff',
          'FOR THE EMPEROR!',
          1.5,
        );
        this.addShake(6);
      }
      this.emitHud();
    }

    // Process Shield Break
    if (hazardEv.shieldBrokenAt) {
      this.sound.playShieldBreak();
      this.particles.spawnShieldShatter(hazardEv.shieldBrokenAt.x, hazardEv.shieldBrokenAt.y);
      this.particles.spawnWorldBanner(
        'IRON HALO HELD!',
        hazardEv.shieldBrokenAt.x,
        hazardEv.shieldBrokenAt.y - 24,
        '#ffe580',
        undefined,
        1.0,
      );
      this.addShake(6);
    }

    // Process Purged Chaos Enemies
    for (const purge of hazardEv.purgedEnemies) {
      this.runPurges += 1;
      this.bonusScore += purge.points;
      this.sound.playPurge();
      this.particles.spawnPurgeExplosion(
        purge.enemy.x + purge.enemy.width / 2,
        purge.enemy.y + purge.enemy.height / 2,
        purge.enemy.kind === 'drone',
      );
      this.particles.spawnWorldBanner(
        purge.enemy.kind === 'drone' ? 'DRONE PURGED!' : 'HERETIC PURGED!',
        purge.enemy.x + purge.enemy.width / 2,
        purge.enemy.y - 10,
        '#ffd86b',
        `+${purge.points} PTS`,
        1.02,
      );
      // Purging keeps an active Zeal Combo alive!
      if (this.combo.active) {
        this.combo.timer = this.combo.maxTimer;
      }
      this.addShake(4.8);
      this.emitHud();
    }

    // Process Knockback Hit
    if (hazardEv.playerKnocked) {
      this.sound.playKnockback();
      this.addShake(7);
      const brokenCombo = finishCombo(this.combo);
      if (brokenCombo.type !== 'none') {
        this.handleComboEvent(brokenCombo);
      }
      this.particles.spawnWorldBanner(
        'STAND FAST!',
        this.player.x + this.player.width / 2,
        this.player.y - 14,
        '#ff6b5c',
        undefined,
        0.92,
      );
      this.emitHud();
    }

    // Jump feedback
    if (phys.jumped) {
      this.sound.playJump(phys.superJump);
      this.particles.spawnJumpBurst(
        this.player.x + this.player.width / 2,
        this.player.y + this.player.height,
        phys.superJump,
        chapter.thrusterCore,
      );
    }

    // Wall rebound feedback
    if (phys.wallBounced) {
      this.sound.playWallBounce();
      const wallX = phys.wallBounceSide < 0 ? SHAFT_LEFT : SHAFT_RIGHT;
      this.particles.spawnWallSparks(
        wallX,
        this.player.y + this.player.height * 0.5,
        -phys.wallBounceSide,
      );
      this.addShake(Math.min(5, 2.2 + phys.wallBounceSpeed * 0.006));
    }

    // Skid sparks on abrupt turnaround
    if (phys.skidding && Math.random() < 0.45) {
      this.particles.spawnSkidSpark(
        this.player.x + this.player.width / 2,
        this.player.y + this.player.height,
        this.player.facing,
      );
    }

    // Spin & Overcharge contrails
    if (this.player.isSpinning || this.player.overchargeTimer > 0) {
      this.spinTrailTimer -= dt;
      if (this.spinTrailTimer <= 0) {
        this.spinTrailTimer = this.player.overchargeTimer > 0 ? 0.015 : 0.025;
        this.particles.spawnSpinTrail(
          this.player.x + this.player.width / 2,
          this.player.y + this.player.height * 0.55,
          this.player.overchargeTimer > 0 ? '#ffe680' : chapter.thrusterCore,
        );
      }
    }

    // Track altitude even during Overcharge flight
    const altitudeFloor = Math.max(0, Math.floor(-(this.player.y + this.player.height) / FLOOR_SPACING));
    if (altitudeFloor > this.player.highestFloor) {
      this.player.highestFloor = altitudeFloor;
    }

    // Landing & combo registration
    if (phys.landedPlatform) {
      const biome = getBiomeForFloor(phys.landedPlatform.floor);
      this.sound.playLand(phys.landedPlatform.isMilestone);
      this.particles.spawnLandingDust(
        this.player.x + this.player.width / 2,
        phys.landedPlatform.y,
        biome.platformAccent,
      );

      if (biome.id !== this.currentBiomeId && phys.landedPlatform.floor >= biome.minFloor) {
        this.currentBiomeId = biome.id;
        this.particles.spawnScreenBanner(biome.name, biome.platformAccent, biome.subtitle, 2.2);
      }

      if (!this.scrollActive && this.player.highestFloor >= SCROLL_START_FLOOR) {
        this.scrollActive = true;
        this.hurryLevel = 1;
        this.hurryTimer = HURRY_INTERVAL_SECONDS;
      }

      const comboEvent = registerFloorLanding(this.combo, phys.floorsJumped);
      this.handleComboEvent(comboEvent);
      this.emitHud();
    }

    const timerEvent = tickCombo(this.combo, dt);
    if (timerEvent.type !== 'none') {
      this.handleComboEvent(timerEvent);
      this.emitHud();
    }

    // Camera upward follow & continuous tower scroll
    const vh = this.renderer.viewHeight;
    const followLine = this.cameraY + vh * 0.36;
    if (this.player.y < followLine) {
      const targetCam = this.player.y - vh * 0.36;
      this.cameraY += (targetCam - this.cameraY) * Math.min(1, dt * 11);
    }

    if (this.scrollActive) {
      const scrollSpeed = HURRY_SCROLL_SPEEDS[this.hurryLevel] ?? HURRY_SCROLL_SPEEDS[MAX_HURRY_LEVEL];
      this.cameraY -= scrollSpeed * dt;

      if (this.hurryLevel < MAX_HURRY_LEVEL) {
        this.hurryTimer -= dt;
        if (this.hurryTimer <= 0) {
          this.hurryLevel++;
          this.hurryTimer = HURRY_INTERVAL_SECONDS;
          this.hurryFlash = 1;
          this.addShake(8);
          this.sound.playHurryUp();
          this.particles.spawnScreenBanner(
            HURRY_CALLOUTS[this.hurryLevel] ?? 'HURRY UP!',
            '#ff5c42',
            `PURGE SPEED LEVEL ${this.hurryLevel}`,
            2.1,
          );
          this.emitHud();
        }
      }
    }

    // Generate platforms + hazards ahead & prune below
    const topVisibleFloor = Math.ceil(-(this.cameraY - 400) / FLOOR_SPACING);
    this.platformMgr.ensureGeneratedUpTo(Math.max(30, topVisibleFloor + 16));
    this.hazardMgr.populateForPlatforms(this.platformMgr.platforms);
    this.platformMgr.pruneBelow(this.cameraY + vh);
    this.hazardMgr.pruneBelow(this.cameraY + vh);

    this.particles.update(dt);
    this.hurryFlash = Math.max(0, this.hurryFlash - dt * 1.4);
    this.updateShake(dt);

    if (this.player.y > this.cameraY + vh + 34) {
      this.triggerGameOver();
    }
  }

  private handleComboEvent(event: ComboEvent): void {
    if (event.type === 'extended') {
      this.sound.playComboStep(event.totalComboFloors);
      if (event.totalComboFloors > this.runBestCombo) {
        this.runBestCombo = event.totalComboFloors;
      }
      this.particles.spawnWorldBanner(
        `+${event.floorsJumped}`,
        this.player.x + this.player.width / 2,
        this.player.y - 14,
        '#72dbff',
        event.jumps > 1 ? `${event.totalComboFloors} FLOOR COMBO` : undefined,
        event.floorsJumped >= 3 ? 1.15 : 0.95,
      );
    } else if (event.type === 'completed') {
      this.bonusScore += event.bonus;
      if (event.totalComboFloors > this.runBestCombo) {
        this.runBestCombo = event.totalComboFloors;
      }
      const color = event.rank?.color ?? '#f5c749';
      const title = event.rank?.title ?? 'COMBO!';

      this.sound.playComboFinish(event.totalComboFloors);
      this.particles.spawnComboCelebration(
        this.player.x + this.player.width / 2,
        this.player.y + 10,
        color,
      );
      this.particles.spawnScreenBanner(
        title,
        color,
        `${event.totalComboFloors} FLOORS  •  +${event.bonus} PTS`,
        1.75,
      );
      this.addShake(Math.min(7, 2.5 + event.totalComboFloors * 0.12));
    }
  }

  private triggerGameOver(): void {
    const pending = finishCombo(this.combo);
    if (pending.type === 'completed') {
      this.bonusScore += pending.bonus;
      if (pending.totalComboFloors > this.runBestCombo) {
        this.runBestCombo = pending.totalComboFloors;
      }
    }

    const finalScore = this.getScore();
    this.records.totalRuns += 1;
    this.records.totalPurges += this.runPurges;
    if (finalScore > this.records.bestScore) {
      this.records.bestScore = finalScore;
      this.isNewBestScore = true;
    }
    if (this.player.highestFloor > this.records.bestFloor) {
      this.records.bestFloor = this.player.highestFloor;
    }
    if (this.runBestCombo > this.records.bestCombo) {
      this.records.bestCombo = this.runBestCombo;
    }
    saveRecords(this.records);

    this.phase = 'gameover';
    this.addShake(10);
    this.sound.playGameOver();
    this.input.clearAll();
    this.emitHud();
  }

  private addShake(amount: number): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, amount);
  }

  private updateShake(dt: number): void {
    if (this.shakeMagnitude > 0.1) {
      this.shakeX = (Math.random() - 0.5) * 2 * this.shakeMagnitude;
      this.shakeY = (Math.random() - 0.5) * 2 * this.shakeMagnitude;
      this.shakeMagnitude = Math.max(0, this.shakeMagnitude - dt * 26);
    } else {
      this.shakeMagnitude = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  private getScore(): number {
    return this.player.highestFloor * 10 + this.bonusScore;
  }

  private render(): void {
    this.renderer.render({
      player: this.player,
      chapter: getChapterTheme(this.chapterId),
      platforms: this.platformMgr.platforms,
      enemies: this.hazardMgr.enemies,
      pickups: this.hazardMgr.pickups,
      particles: this.particles.particles,
      banners: this.particles.banners,
      combo: this.combo,
      cameraY: this.cameraY,
      viewHeight: this.renderer.viewHeight,
      time: this.time,
      hurryLevel: this.hurryLevel,
      scrollActive: this.scrollActive,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      hurryFlash: this.hurryFlash,
    });
  }

  private emitHud(): void {
    const score = this.getScore();
    const biome = getBiomeForFloor(this.player.highestFloor);
    this.onHudUpdate({
      phase: this.phase,
      chapter: this.chapterId,
      score,
      floor: this.player.highestFloor,
      purges: this.runPurges,
      hasIronHalo: this.player.hasIronHalo,
      overchargeActive: this.player.overchargeTimer > 0,
      bestScore: Math.max(this.records.bestScore, score),
      bestFloor: Math.max(this.records.bestFloor, this.player.highestFloor),
      bestCombo: Math.max(this.records.bestCombo, this.runBestCombo),
      comboActive: this.combo.active,
      comboFloors: this.combo.floors,
      comboRatio: this.combo.active ? Math.max(0, this.combo.timer / this.combo.maxTimer) : 0,
      hurryLevel: this.hurryLevel,
      biomeName: biome.name,
      biomeSubtitle: biome.subtitle,
      isNewBestScore: this.isNewBestScore,
      runBestCombo: this.runBestCombo,
    });
  }
}
