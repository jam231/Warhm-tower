import './style.css';
import { CHAPTERS, getChapterTheme } from './game/chapters';
import { GameEngine } from './game/engine';
import { InputManager } from './game/input';
import { TowerRenderer } from './game/renderer';
import { SoundEngine } from './game/sound';
import { loadSettings, saveSettings } from './game/storage';
import type { ChapterId, GameSettings, HudSnapshot } from './game/types';

interface WebKitFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebKitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function mustGet<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing required DOM element: #${id}`);
  }
  return el as T;
}

function isAppleTouchDevice(): boolean {
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || isAppleTouchDevice();
}

function isStandaloneMode(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

function isFullscreenSupported(): boolean {
  const doc = document as WebKitFullscreenDocument;
  const el = document.documentElement as WebKitFullscreenElement;
  const hasRequest =
    typeof el.requestFullscreen === 'function' ||
    typeof el.webkitRequestFullscreen === 'function';
  const enabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? true;
  return hasRequest && enabled !== false;
}

function isCurrentlyFullscreen(): boolean {
  const doc = document as WebKitFullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

async function toggleDocumentFullscreen(): Promise<void> {
  const doc = document as WebKitFullscreenDocument;
  const root = document.documentElement as WebKitFullscreenElement;
  try {
    if (isCurrentlyFullscreen()) {
      if (typeof doc.exitFullscreen === 'function') {
        await doc.exitFullscreen();
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        await doc.webkitExitFullscreen();
      }
    } else if (typeof root.requestFullscreen === 'function') {
      await root.requestFullscreen();
    } else if (typeof root.webkitRequestFullscreen === 'function') {
      await root.webkitRequestFullscreen();
    }
  } catch {
    // Ignore rejection when browser policy disallows fullscreen
  }
}

function bootstrap(): void {
  const stageFrame = mustGet<HTMLElement>('stage-frame');
  const canvas = mustGet<HTMLCanvasElement>('game-canvas');

  // HUD elements
  const hudBar = mustGet<HTMLElement>('hud-bar');
  const hudFloor = mustGet<HTMLElement>('hud-floor');
  const hudScore = mustGet<HTMLElement>('hud-score');
  const hudPurges = mustGet<HTMLElement>('hud-purges');
  const hudHaloBadge = mustGet<HTMLElement>('hud-halo-badge');
  const comboHud = mustGet<HTMLElement>('combo-hud');
  const comboCount = mustGet<HTMLElement>('combo-count');
  const comboFill = mustGet<HTMLElement>('combo-fill');

  // Overlays
  const overlayTitle = mustGet<HTMLElement>('overlay-title');
  const overlayPause = mustGet<HTMLElement>('overlay-pause');
  const overlayGameover = mustGet<HTMLElement>('overlay-gameover');

  // Title stats & Chapter Picker
  const titleMotto = mustGet<HTMLElement>('title-motto');
  const selectedChapterName = mustGet<HTMLElement>('selected-chapter-name');
  const chapterListEl = mustGet<HTMLElement>('chapter-list');
  const titleBestScore = mustGet<HTMLElement>('title-best-score');
  const titleBestFloor = mustGet<HTMLElement>('title-best-floor');
  const titleBestCombo = mustGet<HTMLElement>('title-best-combo');

  // Game Over stats
  const gameoverBadge = mustGet<HTMLElement>('gameover-badge');
  const overScore = mustGet<HTMLElement>('over-score');
  const overFloor = mustGet<HTMLElement>('over-floor');
  const overPurges = mustGet<HTMLElement>('over-purges');
  const overCombo = mustGet<HTMLElement>('over-combo');

  // Buttons & Settings
  const btnStart = mustGet<HTMLButtonElement>('btn-start');
  const btnTitleFullscreen = mustGet<HTMLButtonElement>('btn-title-fullscreen');
  const iosFsTip = mustGet<HTMLElement>('ios-fs-tip');
  const btnFullscreen = mustGet<HTMLButtonElement>('btn-fullscreen');
  const iconFsEnter = mustGet<HTMLElement>('icon-fs-enter');
  const iconFsExit = mustGet<HTMLElement>('icon-fs-exit');
  const btnPause = mustGet<HTMLButtonElement>('btn-pause');
  const btnMute = mustGet<HTMLButtonElement>('btn-mute');
  const iconSoundOn = mustGet<HTMLElement>('icon-sound-on');
  const iconSoundOff = mustGet<HTMLElement>('icon-sound-off');

  const btnResume = mustGet<HTMLButtonElement>('btn-resume');
  const btnPauseRestart = mustGet<HTMLButtonElement>('btn-pause-restart');
  const btnToTitle = mustGet<HTMLButtonElement>('btn-to-title');
  const btnRetry = mustGet<HTMLButtonElement>('btn-retry');
  const btnOverTitle = mustGet<HTMLButtonElement>('btn-over-title');

  const btnPauseFullscreen = mustGet<HTMLButtonElement>('btn-pause-fullscreen');
  const labelFullscreenState = mustGet<HTMLElement>('label-fullscreen-state');
  const btnToggleTouch = mustGet<HTMLButtonElement>('btn-toggle-touch');
  const labelTouchMode = mustGet<HTMLElement>('label-touch-mode');
  const btnToggleLayout = mustGet<HTMLButtonElement>('btn-toggle-layout');
  const labelTouchLayout = mustGet<HTMLElement>('label-touch-layout');
  const btnToggleAutoJump = mustGet<HTMLButtonElement>('btn-toggle-autojump');
  const labelAutoJump = mustGet<HTMLElement>('label-autojump');
  const btnSwapSides = mustGet<HTMLButtonElement>('btn-swap-sides');
  const labelSwapSides = mustGet<HTMLElement>('label-swap-sides');
  const btnPauseMute = mustGet<HTMLButtonElement>('btn-pause-mute');
  const labelMuteState = mustGet<HTMLElement>('label-mute-state');

  // Touch controls
  const touchControls = mustGet<HTMLElement>('touch-controls');
  const touchMovePad = mustGet<HTMLElement>('touch-move-pad');
  const touchMoveKnob = mustGet<HTMLElement>('touch-move-knob');
  const touchSplitPad = mustGet<HTMLElement>('touch-split-pad');
  const touchLeftBtn = mustGet<HTMLButtonElement>('touch-left-btn');
  const touchRightBtn = mustGet<HTMLButtonElement>('touch-right-btn');
  const touchJumpBtn = mustGet<HTMLButtonElement>('touch-jump-btn');
  const touchJumpCaption = mustGet<HTMLElement>('touch-jump-caption');

  const settings: GameSettings = loadSettings();
  let touchDetected = isTouchDevice();
  const fsSupported = isFullscreenSupported() && !isStandaloneMode();

  const sound = new SoundEngine(settings.muted);
  const renderer = new TowerRenderer(canvas);

  let engine: GameEngine;

  // Render Space Marine Chapter picker buttons
  const chapterButtons = new Map<ChapterId, HTMLButtonElement>();
  for (const ch of CHAPTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chapter-btn';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', ch.name);
    btn.innerHTML = `
      <span class="chapter-swatch" style="--swatch-light:${ch.armorLight};--swatch-mid:${ch.armorMid};--swatch-trim:${ch.trim}"></span>
      <span class="chapter-code">${ch.shortName}</span>
    `;
    btn.addEventListener('click', () => {
      sound.unlock();
      settings.chapter = ch.id;
      saveSettings(settings);
      engine.setChapter(ch.id);
      syncChapterUi();
    });
    chapterButtons.set(ch.id, btn);
    chapterListEl.appendChild(btn);
  }

  const syncFullscreenUi = (): void => {
    const active = isCurrentlyFullscreen();
    btnFullscreen.classList.toggle('is-hidden', !fsSupported);
    btnTitleFullscreen.classList.toggle('is-hidden', !fsSupported);
    btnPauseFullscreen.classList.toggle('is-hidden', !fsSupported);

    // Show Add-to-Home-Screen hint on iOS/iPadOS browsers without Fullscreen API
    iosFsTip.classList.toggle(
      'is-hidden',
      fsSupported || isStandaloneMode() || !isAppleTouchDevice(),
    );

    iconFsEnter.classList.toggle('is-hidden', active);
    iconFsExit.classList.toggle('is-hidden', !active);
    labelFullscreenState.textContent = active ? 'On' : 'Off';
    btnTitleFullscreen.textContent = active ? 'EXIT FULL SCREEN' : 'FULL SCREEN';
  };

  const syncChapterUi = (): void => {
    const active = getChapterTheme(settings.chapter);
    titleMotto.textContent = active.motto;
    selectedChapterName.textContent = active.name;
    for (const [id, btn] of chapterButtons.entries()) {
      const selected = id === settings.chapter;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-checked', String(selected));
    }
  };

  const syncSettingsUi = (): void => {
    iconSoundOn.classList.toggle('is-hidden', settings.muted);
    iconSoundOff.classList.toggle('is-hidden', !settings.muted);
    labelMuteState.textContent = settings.muted ? 'Muted' : 'On';

    labelTouchMode.textContent =
      settings.showTouchControls === 'auto'
        ? 'Auto'
        : settings.showTouchControls === 'on'
          ? 'Always On'
          : 'Off';

    labelTouchLayout.textContent =
      settings.touchLayout === 'buttons' ? 'Split Buttons' : 'Slide Rocker';
    labelAutoJump.textContent = settings.autoJump ? 'On' : 'Off';
    labelSwapSides.textContent = settings.swapTouchSides ? 'Swapped' : 'Default';

    touchControls.classList.toggle('is-swapped', settings.swapTouchSides);
    touchMovePad.classList.toggle('is-hidden', settings.touchLayout !== 'rocker');
    touchSplitPad.classList.toggle('is-hidden', settings.touchLayout !== 'buttons');
    touchJumpBtn.classList.toggle('is-auto-mode', settings.autoJump);
    touchJumpCaption.textContent = settings.autoJump ? 'AUTO' : 'JUMP';

    const shouldShowTouch =
      engine?.getPhase() === 'playing' &&
      (settings.showTouchControls === 'on' ||
        (settings.showTouchControls === 'auto' && touchDetected));
    touchControls.classList.toggle('is-hidden', !shouldShowTouch);
  };

  const toggleMute = (): void => {
    settings.muted = !settings.muted;
    sound.setMuted(settings.muted);
    if (!settings.muted) {
      sound.unlock();
    }
    saveSettings(settings);
    syncSettingsUi();
  };

  const handleFullscreenToggle = (): void => {
    if (!fsSupported) return;
    void toggleDocumentFullscreen().then(() => {
      syncFullscreenUi();
      window.setTimeout(handleResize, 60);
    });
  };

  const input = new InputManager({
    onFirstGesture: () => sound.unlock(),
    onPauseToggle: () => engine.togglePause(),
    onQuickRestart: () => {
      if (
        engine.getPhase() === 'playing' ||
        engine.getPhase() === 'gameover' ||
        engine.getPhase() === 'paused'
      ) {
        engine.startGame();
      }
    },
    onMuteToggle: toggleMute,
    onFullscreenToggle: handleFullscreenToggle,
    onTouchDetected: () => {
      if (!touchDetected) {
        touchDetected = true;
        syncSettingsUi();
      }
    },
  });

  input.bindTouchElements({
    canvas,
    touchRoot: touchControls,
    movePad: touchMovePad,
    moveKnob: touchMoveKnob,
    splitPad: touchSplitPad,
    leftBtn: touchLeftBtn,
    rightBtn: touchRightBtn,
    jumpBtn: touchJumpBtn,
  });

  const onHudUpdate = (hud: HudSnapshot): void => {
    const isPlaying = hud.phase === 'playing';
    const isPaused = hud.phase === 'paused';
    const isTitle = hud.phase === 'title';
    const isGameOver = hud.phase === 'gameover';

    hudBar.classList.toggle('is-hidden', isTitle);
    overlayTitle.classList.toggle('is-hidden', !isTitle);
    overlayPause.classList.toggle('is-hidden', !isPaused);
    overlayGameover.classList.toggle('is-hidden', !isGameOver);

    hudFloor.textContent = String(hud.floor);
    hudScore.textContent = hud.score.toLocaleString();
    hudPurges.textContent = String(hud.purges);
    hudHaloBadge.classList.toggle('is-hidden', !hud.hasIronHalo);

    if (isPlaying && hud.comboActive) {
      comboHud.classList.remove('is-hidden');
      comboCount.textContent = `+${hud.comboFloors} FLOORS`;
      comboFill.style.transform = `scaleX(${hud.comboRatio.toFixed(3)})`;
    } else {
      comboHud.classList.add('is-hidden');
    }

    if (isTitle) {
      titleBestScore.textContent = hud.bestScore.toLocaleString();
      titleBestFloor.textContent = String(hud.bestFloor);
      titleBestCombo.textContent = String(hud.bestCombo);
    }

    if (isGameOver) {
      gameoverBadge.textContent = hud.isNewBestScore
        ? 'NEW CHAPTER RECORD SET!'
        : 'ONLY IN DEATH DOES DUTY END';
      overScore.textContent = hud.score.toLocaleString();
      overFloor.textContent = String(hud.floor);
      overPurges.textContent = String(hud.purges);
      overCombo.textContent = String(hud.runBestCombo);
    }

    syncSettingsUi();
  };

  engine = new GameEngine(
    renderer,
    input,
    sound,
    settings.chapter,
    settings.autoJump,
    onHudUpdate,
  );

  const blurActive = (): void => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Wire UI buttons
  btnStart.addEventListener('click', () => {
    blurActive();
    engine.startGame();
  });
  btnTitleFullscreen.addEventListener('click', () => {
    blurActive();
    handleFullscreenToggle();
  });
  btnFullscreen.addEventListener('click', () => {
    blurActive();
    handleFullscreenToggle();
  });
  btnPauseFullscreen.addEventListener('click', () => {
    blurActive();
    handleFullscreenToggle();
  });
  btnPause.addEventListener('click', () => {
    blurActive();
    engine.togglePause();
  });
  btnMute.addEventListener('click', () => {
    blurActive();
    toggleMute();
  });
  btnPauseMute.addEventListener('click', toggleMute);
  btnResume.addEventListener('click', () => {
    blurActive();
    engine.resumeGame();
  });
  btnPauseRestart.addEventListener('click', () => {
    blurActive();
    engine.startGame();
  });
  btnToTitle.addEventListener('click', () => engine.returnToTitle());
  btnRetry.addEventListener('click', () => {
    blurActive();
    engine.startGame();
  });
  btnOverTitle.addEventListener('click', () => engine.returnToTitle());

  btnToggleTouch.addEventListener('click', () => {
    const order: GameSettings['showTouchControls'][] = ['auto', 'on', 'off'];
    const nextIdx = (order.indexOf(settings.showTouchControls) + 1) % order.length;
    settings.showTouchControls = order[nextIdx];
    saveSettings(settings);
    syncSettingsUi();
  });

  btnToggleLayout.addEventListener('click', () => {
    settings.touchLayout = settings.touchLayout === 'rocker' ? 'buttons' : 'rocker';
    saveSettings(settings);
    syncSettingsUi();
  });

  btnToggleAutoJump.addEventListener('click', () => {
    settings.autoJump = !settings.autoJump;
    engine.setAutoJump(settings.autoJump);
    saveSettings(settings);
    syncSettingsUi();
  });

  btnSwapSides.addEventListener('click', () => {
    settings.swapTouchSides = !settings.swapTouchSides;
    saveSettings(settings);
    syncSettingsUi();
  });

  // Start / Retry quickly with Enter or Space from Title / Game Over screens
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.code === 'Enter' || e.code === 'Space') {
      const phase = engine.getPhase();
      if (phase === 'title' || phase === 'gameover') {
        e.preventDefault();
        engine.startGame();
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && engine.getPhase() === 'playing') {
      engine.pauseGame();
    }
  });

  const handleResize = (): void => {
    const vp = window.visualViewport;
    const width = Math.round(vp?.width ?? window.innerWidth ?? stageFrame.clientWidth);
    const height = Math.round(vp?.height ?? window.innerHeight ?? stageFrame.clientHeight);
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    engine.resize(width, height);
  };

  handleResize();
  window.addEventListener('resize', handleResize);
  window.visualViewport?.addEventListener('resize', handleResize);
  window.visualViewport?.addEventListener('scroll', handleResize);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(handleResize, 120);
    window.setTimeout(handleResize, 320);
  });
  document.addEventListener('fullscreenchange', () => {
    syncFullscreenUi();
    window.setTimeout(handleResize, 60);
  });
  document.addEventListener('webkitfullscreenchange', () => {
    syncFullscreenUi();
    window.setTimeout(handleResize, 60);
  });

  syncFullscreenUi();
  syncChapterUi();
  syncSettingsUi();
  engine.startLoop();
}

bootstrap();
