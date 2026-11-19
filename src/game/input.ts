import type { InputState } from './types';

export interface InputCallbacks {
  onFirstGesture: () => void;
  onPauseToggle: () => void;
  onQuickRestart: () => void;
  onMuteToggle: () => void;
  onTouchDetected: () => void;
}

export interface TouchControlElements {
  movePad: HTMLElement;
  moveKnob: HTMLElement;
  leftBtn: HTMLElement;
  rightBtn: HTMLElement;
  jumpBtn: HTMLElement;
}

export class InputManager {
  private keys = new Set<string>();
  private jumpQueued = false;

  // Slide rocker tracking
  private movePointerId: number | null = null;
  private touchAxisX = 0;

  // Discrete Left/Right button tracking (multi-touch safe)
  private leftPointerIds = new Set<number>();
  private rightPointerIds = new Set<number>();
  private jumpPointerIds = new Set<number>();

  private elements: TouchControlElements | null = null;
  private callbacks: InputCallbacks;
  private prevGamepadJump = false;

  constructor(callbacks: InputCallbacks) {
    this.callbacks = callbacks;
    this.bindKeyboard();
  }

  public bindTouchElements(els: TouchControlElements): void {
    this.elements = els;
    const { movePad, leftBtn, rightBtn, jumpBtn } = els;

    // 1. Continuous Thumb Slide Rocker
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

    movePad.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      this.callbacks.onFirstGesture();
      this.callbacks.onTouchDetected();
      this.movePointerId = e.pointerId;
      try {
        movePad.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if capture unsupported
      }
      updateRockerFromClientX(e.clientX);
    });

    movePad.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.movePointerId) return;
      e.preventDefault();
      updateRockerFromClientX(e.clientX);
    });

    const releaseMove = (e: PointerEvent): void => {
      if (e.pointerId !== this.movePointerId) return;
      e.preventDefault();
      this.movePointerId = null;
      this.touchAxisX = 0;
      this.syncTouchVisuals();
    };

    movePad.addEventListener('pointerup', releaseMove);
    movePad.addEventListener('pointercancel', releaseMove);
    movePad.addEventListener('lostpointercapture', releaseMove);

    // 2. Discrete Left / Right Buttons
    const bindHoldButton = (btn: HTMLElement, activeSet: Set<number>): void => {
      btn.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        this.callbacks.onFirstGesture();
        this.callbacks.onTouchDetected();
        activeSet.add(e.pointerId);
        try {
          btn.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
        this.syncTouchVisuals();
      });

      const release = (e: PointerEvent): void => {
        if (!activeSet.has(e.pointerId)) return;
        e.preventDefault();
        activeSet.delete(e.pointerId);
        this.syncTouchVisuals();
      };

      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
    };

    bindHoldButton(leftBtn, this.leftPointerIds);
    bindHoldButton(rightBtn, this.rightPointerIds);

    // 3. Jump Pack Button
    jumpBtn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      this.callbacks.onFirstGesture();
      this.callbacks.onTouchDetected();
      if (!this.jumpPointerIds.has(e.pointerId)) {
        this.jumpPointerIds.add(e.pointerId);
        this.jumpQueued = true;
      }
      try {
        jumpBtn.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      this.syncTouchVisuals();
    });

    const releaseJump = (e: PointerEvent): void => {
      if (!this.jumpPointerIds.has(e.pointerId)) return;
      e.preventDefault();
      this.jumpPointerIds.delete(e.pointerId);
      this.syncTouchVisuals();
    };

    jumpBtn.addEventListener('pointerup', releaseJump);
    jumpBtn.addEventListener('pointercancel', releaseJump);
    jumpBtn.addEventListener('lostpointercapture', releaseJump);

    window.addEventListener(
      'touchstart',
      () => {
        this.callbacks.onFirstGesture();
        this.callbacks.onTouchDetected();
      },
      { passive: true },
    );
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
    this.leftPointerIds.clear();
    this.rightPointerIds.clear();
    this.jumpPointerIds.clear();
    this.movePointerId = null;
    this.touchAxisX = 0;
    this.jumpQueued = false;
    this.syncTouchVisuals();
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

    const btnLeft = this.leftPointerIds.size > 0;
    const btnRight = this.rightPointerIds.size > 0;
    const touchBtnAxis = (btnRight ? 1 : 0) - (btnLeft ? 1 : 0);
    const touchJumpHeld = this.jumpPointerIds.size > 0;
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

    leftBtn.classList.toggle('is-pressed', this.leftPointerIds.size > 0);
    rightBtn.classList.toggle('is-pressed', this.rightPointerIds.size > 0);
    jumpBtn.classList.toggle('is-pressed', this.jumpPointerIds.size > 0);
  }
}
