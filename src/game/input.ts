import type { InputState } from './types';

export interface InputCallbacks {
  onFirstGesture: () => void;
  onPauseToggle: () => void;
  onQuickRestart: () => void;
  onMuteToggle: () => void;
  onFullscreenToggle?: () => void;
  onTouchDetected: () => void;
}

export interface TouchControlElements {
  canvas: HTMLElement;
  touchRoot: HTMLElement;
  movePad: HTMLElement;
  moveKnob: HTMLElement;
  splitPad: HTMLElement;
  leftBtn: HTMLElement;
  rightBtn: HTMLElement;
  jumpBtn: HTMLElement;
}

export class InputManager {
  private keys = new Set<string>();
  private jumpQueued = false;

  // Slide rocker tracking (touch identifier + non-touch pointer id)
  private moveTouchId: number | null = null;
  private moveMousePointerId: number | null = null;
  private touchAxisX = 0;

  // Discrete Left/Right split-pad tracking (supports multi-touch & thumb-sliding)
  private splitTouches = new Map<number, -1 | 1>();
  private leftMousePointerIds = new Set<number>();
  private rightMousePointerIds = new Set<number>();

  // Jump button tracking (touch identifiers + non-touch pointer ids)
  private jumpTouchIds = new Set<number>();
  private jumpMousePointerIds = new Set<number>();

  private elements: TouchControlElements | null = null;
  private callbacks: InputCallbacks;
  private prevGamepadJump = false;

  constructor(callbacks: InputCallbacks) {
    this.callbacks = callbacks;
    this.bindKeyboard();
  }

  public bindTouchElements(els: TouchControlElements): void {
    this.elements = els;
    const { canvas, touchRoot, movePad, splitPad, leftBtn, rightBtn, jumpBtn } = els;

    // Install iPadOS / iOS Safari zoom & gesture guards so rapid tapping or
    // simultaneous dual-thumb play never triggers pinch-zoom, double-tap zoom,
    // rubber-band scrolling, or text selection callouts.
    this.installMobileZoomGuards(canvas, touchRoot);

    const updateRockerFromClientX = (clientX: number): void => {
      const rect = movePad.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const half = Math.max(1, rect.width / 2);
      const raw = (clientX - center) / (half * 0.72);
      const clamped = Math.max(-1, Math.min(1, raw));
      if (Math.abs(clamped) < 0.1) {
        this.touchAxisX = 0;
      } else {
        this.touchAxisX = Math.sign(clamped) * Math.min(1, 0.45 + Math.abs(clamped) * 0.65);
      }
      this.syncTouchVisuals();
    };

    const resolveSplitDirection = (clientX: number): -1 | 1 => {
      const leftRect = leftBtn.getBoundingClientRect();
      const rightRect = rightBtn.getBoundingClientRect();
      const midpoint = (leftRect.right + rightRect.left) / 2;
      return clientX < midpoint ? -1 : 1;
    };

    // =========================================================================
    // 1. CONTINUOUS THUMB SLIDE ROCKER (Native Touch Events + Mouse Fallback)
    // =========================================================================
    movePad.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        e.preventDefault();
        this.callbacks.onFirstGesture();
        this.callbacks.onTouchDetected();
        if (this.moveTouchId === null && e.changedTouches.length > 0) {
          const touch = e.changedTouches[0];
          this.moveTouchId = touch.identifier;
          updateRockerFromClientX(touch.clientX);
        }
      },
      { passive: false },
    );

    movePad.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        e.preventDefault();
        if (this.moveTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.moveTouchId) {
            updateRockerFromClientX(touch.clientX);
            break;
          }
        }
      },
      { passive: false },
    );

    const releaseMoveTouch = (e: TouchEvent): void => {
      e.preventDefault();
      if (this.moveTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.moveTouchId) {
          this.moveTouchId = null;
          this.touchAxisX = 0;
          this.syncTouchVisuals();
          break;
        }
      }
    };

    movePad.addEventListener('touchend', releaseMoveTouch, { passive: false });
    movePad.addEventListener('touchcancel', releaseMoveTouch, { passive: false });

    // Non-touch pointer fallback (desktop mouse / iPad trackpad / Apple Pencil)
    movePad.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      this.callbacks.onFirstGesture();
      this.moveMousePointerId = e.pointerId;
      try {
        movePad.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if capture unsupported
      }
      updateRockerFromClientX(e.clientX);
    });

    movePad.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.pointerId !== this.moveMousePointerId) return;
      e.preventDefault();
      updateRockerFromClientX(e.clientX);
    });

    const releaseMoveMouse = (e: PointerEvent): void => {
      if (e.pointerType === 'touch' || e.pointerId !== this.moveMousePointerId) return;
      this.moveMousePointerId = null;
      this.touchAxisX = 0;
      this.syncTouchVisuals();
    };

    movePad.addEventListener('pointerup', releaseMoveMouse);
    movePad.addEventListener('pointercancel', releaseMoveMouse);
    movePad.addEventListener('lostpointercapture', releaseMoveMouse);

    // =========================================================================
    // 2. DISCRETE SPLIT LEFT / RIGHT BUTTONS (Touch with seamless thumb-roll)
    // =========================================================================
    splitPad.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        e.preventDefault();
        this.callbacks.onFirstGesture();
        this.callbacks.onTouchDetected();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          this.splitTouches.set(touch.identifier, resolveSplitDirection(touch.clientX));
        }
        this.syncTouchVisuals();
      },
      { passive: false },
    );

    splitPad.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        e.preventDefault();
        let changed = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (this.splitTouches.has(touch.identifier)) {
            const dir = resolveSplitDirection(touch.clientX);
            if (this.splitTouches.get(touch.identifier) !== dir) {
              this.splitTouches.set(touch.identifier, dir);
              changed = true;
            }
          }
        }
        if (changed) {
          this.syncTouchVisuals();
        }
      },
      { passive: false },
    );

    const releaseSplitTouch = (e: TouchEvent): void => {
      e.preventDefault();
      let changed = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (this.splitTouches.delete(e.changedTouches[i].identifier)) {
          changed = true;
        }
      }
      if (changed) {
        this.syncTouchVisuals();
      }
    };

    splitPad.addEventListener('touchend', releaseSplitTouch, { passive: false });
    splitPad.addEventListener('touchcancel', releaseSplitTouch, { passive: false });

    // Non-touch pointer fallback for Left / Right buttons
    const bindMouseHoldButton = (btn: HTMLElement, activeSet: Set<number>): void => {
      btn.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        this.callbacks.onFirstGesture();
        activeSet.add(e.pointerId);
        try {
          btn.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
        this.syncTouchVisuals();
      });

      const release = (e: PointerEvent): void => {
        if (e.pointerType === 'touch' || !activeSet.has(e.pointerId)) return;
        activeSet.delete(e.pointerId);
        this.syncTouchVisuals();
      };

      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
    };

    bindMouseHoldButton(leftBtn, this.leftMousePointerIds);
    bindMouseHoldButton(rightBtn, this.rightMousePointerIds);

    // =========================================================================
    // 3. JUMP PACK BUTTON (Native Touch Events + Mouse Fallback)
    // =========================================================================
    jumpBtn.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        e.preventDefault();
        this.callbacks.onFirstGesture();
        this.callbacks.onTouchDetected();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const id = e.changedTouches[i].identifier;
          if (!this.jumpTouchIds.has(id)) {
            this.jumpTouchIds.add(id);
            this.jumpQueued = true;
          }
        }
        this.syncTouchVisuals();
      },
      { passive: false },
    );

    jumpBtn.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        e.preventDefault();
      },
      { passive: false },
    );

    const releaseJumpTouch = (e: TouchEvent): void => {
      e.preventDefault();
      let changed = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (this.jumpTouchIds.delete(e.changedTouches[i].identifier)) {
          changed = true;
        }
      }
      if (changed) {
        this.syncTouchVisuals();
      }
    };

    jumpBtn.addEventListener('touchend', releaseJumpTouch, { passive: false });
    jumpBtn.addEventListener('touchcancel', releaseJumpTouch, { passive: false });

    // Non-touch pointer fallback for Jump button
    jumpBtn.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      this.callbacks.onFirstGesture();
      if (!this.jumpMousePointerIds.has(e.pointerId)) {
        this.jumpMousePointerIds.add(e.pointerId);
        this.jumpQueued = true;
      }
      try {
        jumpBtn.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      this.syncTouchVisuals();
    });

    const releaseJumpMouse = (e: PointerEvent): void => {
      if (e.pointerType === 'touch' || !this.jumpMousePointerIds.has(e.pointerId)) return;
      this.jumpMousePointerIds.delete(e.pointerId);
      this.syncTouchVisuals();
    };

    jumpBtn.addEventListener('pointerup', releaseJumpMouse);
    jumpBtn.addEventListener('pointercancel', releaseJumpMouse);
    jumpBtn.addEventListener('lostpointercapture', releaseJumpMouse);
  }

  private installMobileZoomGuards(canvas: HTMLElement, touchRoot: HTMLElement): void {
    const prevent = (e: Event): void => {
      e.preventDefault();
    };

    // Block Apple WebKit pinch-zoom gestures everywhere
    document.addEventListener('gesturestart', prevent, { passive: false });
    document.addEventListener('gesturechange', prevent, { passive: false });
    document.addEventListener('gestureend', prevent, { passive: false });

    // Block multi-touch pinch anywhere on the document, while allowing single-finger
    // taps on menus/HUD buttons to work normally.
    document.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        this.callbacks.onFirstGesture();
        this.callbacks.onTouchDetected();
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      },
      { passive: false },
    );

    // Block rubber-band scrolling / panning outside scrollable overlay plates
    document.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('.panel-plate')) {
          if (e.touches.length > 1) {
            e.preventDefault();
          }
          return;
        }
        e.preventDefault();
      },
      { passive: false },
    );

    // Block double-tap zoom, pinch, and callouts directly on canvas & touch controls
    for (const el of [canvas, touchRoot]) {
      el.addEventListener('touchstart', prevent, { passive: false });
      el.addEventListener('touchmove', prevent, { passive: false });
      el.addEventListener('touchend', prevent, { passive: false });
      el.addEventListener('touchcancel', prevent, { passive: false });
      el.addEventListener('dblclick', prevent, { passive: false });
      el.addEventListener('contextmenu', prevent);
    }
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      this.callbacks.onFirstGesture();
      const code = e.code;

      if (
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }

      if (!e.repeat) {
        if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
          this.jumpQueued = true;
        } else if (code === 'KeyP' || code === 'Escape') {
          this.callbacks.onPauseToggle();
        } else if (code === 'KeyR') {
          this.callbacks.onQuickRestart();
        } else if (code === 'KeyM') {
          this.callbacks.onMuteToggle();
        } else if (code === 'KeyF') {
          this.callbacks.onFullscreenToggle?.();
        }
      }

      this.keys.add(code);
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.clearAll();
    });
  }

  public clearAll(): void {
    this.keys.clear();
    this.splitTouches.clear();
    this.leftMousePointerIds.clear();
    this.rightMousePointerIds.clear();
    this.jumpTouchIds.clear();
    this.jumpMousePointerIds.clear();
    this.moveTouchId = null;
    this.moveMousePointerId = null;
    this.touchAxisX = 0;
    this.jumpQueued = false;
    this.syncTouchVisuals();
  }

  private hasSplitLeft(): boolean {
    if (this.leftMousePointerIds.size > 0) return true;
    for (const dir of this.splitTouches.values()) {
      if (dir < 0) return true;
    }
    return false;
  }

  private hasSplitRight(): boolean {
    if (this.rightMousePointerIds.size > 0) return true;
    for (const dir of this.splitTouches.values()) {
      if (dir > 0) return true;
    }
    return false;
  }

  public pollInput(): InputState {
    let keyLeft = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    let keyRight = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    let keyJumpHeld =
      this.keys.has('Space') || this.keys.has('ArrowUp') || this.keys.has('KeyW');

    let padAxisX = 0;
    let padJumpHeld = false;
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad) continue;
        const ax = pad.axes[0] ?? 0;
        if (Math.abs(ax) > 0.2) {
          padAxisX = ax;
        }
        if (pad.buttons[14]?.pressed) keyLeft = true;
        if (pad.buttons[15]?.pressed) keyRight = true;
        if (pad.buttons[0]?.pressed || pad.buttons[1]?.pressed || pad.buttons[12]?.pressed) {
          padJumpHeld = true;
        }
      }
    }

    if (padJumpHeld && !this.prevGamepadJump) {
      this.jumpQueued = true;
    }
    this.prevGamepadJump = padJumpHeld;

    const btnLeft = this.hasSplitLeft();
    const btnRight = this.hasSplitRight();
    const touchBtnAxis = (btnRight ? 1 : 0) - (btnLeft ? 1 : 0);
    const touchJumpHeld = this.jumpTouchIds.size > 0 || this.jumpMousePointerIds.size > 0;
    const keyAxis = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);

    let axisX = 0;
    if (Math.abs(this.touchAxisX) > 0.05) {
      axisX = this.touchAxisX;
    } else if (touchBtnAxis !== 0) {
      axisX = touchBtnAxis;
    } else if (Math.abs(padAxisX) > 0.2) {
      axisX = padAxisX;
    } else {
      axisX = keyAxis;
    }

    const jumpPressed = this.jumpQueued;
    this.jumpQueued = false;

    return {
      left: keyLeft || btnLeft || axisX < -0.1,
      right: keyRight || btnRight || axisX > 0.1,
      axisX,
      jumpHeld: keyJumpHeld || touchJumpHeld || padJumpHeld,
      jumpPressed,
    };
  }

  private syncTouchVisuals(): void {
    if (!this.elements) return;
    const { movePad, moveKnob, leftBtn, rightBtn, jumpBtn } = this.elements;

    movePad.classList.toggle('is-left', this.touchAxisX < -0.1);
    movePad.classList.toggle('is-right', this.touchAxisX > 0.1);
    moveKnob.style.transform = `translateX(${this.touchAxisX * 32}px)`;

    leftBtn.classList.toggle('is-pressed', this.hasSplitLeft());
    rightBtn.classList.toggle('is-pressed', this.hasSplitRight());
    jumpBtn.classList.toggle(
      'is-pressed',
      this.jumpTouchIds.size > 0 || this.jumpMousePointerIds.size > 0,
    );
  }
}
