// input.js — Tastatur + Maus (Desktop) mit Pointer-Lock.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
    this.attack = false;       // Maustaste gedrückt
    this.attackPressed = false; // nur in diesem Frame
    this.usePressed = false;    // rechte Maustaste in diesem Frame
    this.use = false;
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 0.0022;
    this.onPause = null;
    this.onKey = null;
    this.shouldCaptureWheel = null;

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.onKey) this.onKey(e.code, true, e);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F3', 'KeyE'].includes(e.code)) {
        if (e.code === 'Tab' || e.code === 'F3' || e.code === 'Space') e.preventDefault();
      }
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (this.onKey) this.onKey(e.code, false, e);
    };
    this._onMouseMove = (e) => {
      if (!this.enabled) return;
      // Mit Pointer-Lock immer; ohne Lock nur bei gedrückter Maustaste (Drag-Look-Fallback,
      // z. B. wenn Pointer-Lock in iframes blockiert ist)
      if (!this.locked && !this.attack && !this.use && !this.dragLook) return;
      this.mouseDX += e.movementX || (e.mozMovementX || 0);
      this.mouseDY += e.movementY || (e.mozMovementY || 0);
    };
    this._onMouseDown = (e) => {
      if (!this.enabled) return;
      // Ohne Pointer-Lock: Buttons funktionieren trotzdem (Drag-Look),
      // aber nur wenn wir im Spiel sind (Canvas-Fokus)
      if (!this.locked && e.target !== this.canvas) return;
      if (e.button === 0) { this.attack = true; this.attackPressed = true; }
      if (e.button === 2) { this.use = true; this.usePressed = true; }
      if (e.button === 1) { e.preventDefault(); this.pickPressed = true; }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.attack = false;
      if (e.button === 2) this.use = false;
    };
    this._onWheel = (e) => {
      if (!this.enabled || (this.shouldCaptureWheel && !this.shouldCaptureWheel())) return;
      this.wheelDelta += Math.sign(e.deltaY);
      e.preventDefault();
    };
    this._onContext = (e) => e.preventDefault();
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.onPause) this.onPause();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this._onContext);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }

  /** Pointer Lock anfordern. */
  lock() {
    if (this.canvas.requestPointerLock) {
      this.canvas.requestPointerLock();
    }
  }

  unlock() {
    if (document.exitPointerLock) document.exitPointerLock();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  /** Bewegungsinput aus Tastatur. */
  movement() {
    let forward = 0;
    let right = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) forward += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) forward -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) right += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) right -= 1;
    return {
      forward,
      right,
      jump: this.isDown('Space'),
      sneak: this.isDown('ShiftLeft') || this.isDown('ShiftRight'),
      sprint: this.isDown('ControlLeft') || this.isDown('ControlRight') || this.isDown('KeyR') || this.sprintToggle,
    };
  }

  /** Mausdelta abholen und zurücksetzen. */
  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx: dx * this.sensitivity, dy: dy * this.sensitivity };
  }

  consumeWheel() {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  consumePressed() {
    const a = this.attackPressed;
    const u = this.usePressed;
    const p = this.pickPressed;
    this.attackPressed = false;
    this.usePressed = false;
    this.pickPressed = false;
    return { attack: a, use: u, pick: p };
  }
}
