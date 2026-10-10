// touch.js — Mobile Steuerung: virtueller Joystick, Look-Drag, Buttons, Multi-Touch.

export function isTouchDevice() {
  return (
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

// Touch/Emulated-Maus-Doppel-Events verhindern
let lastTouchTime = -Infinity;
export function markTouchEvent() {
  lastTouchTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
}
export function wasRecentTouch() {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) - lastTouchTime < 700;
}

export class TouchControls {
  /**
   * @param {object} els DOM-Elemente
   *   joystickZone, lookZone, btnJump, btnSneak, btnFly, btnAttack, btnPlace, btnInventory, btnMenu
   * @param {object} opts { sensitivity, onAction(name) }
   */
  constructor(els, opts = {}) {
    this.els = els;
    this.sensitivity = opts.sensitivity ?? 0.0042;
    this.onAction = opts.onAction || (() => {});

    // Joystick
    this.joyId = null;
    this.joyOrigin = { x: 0, y: 0 };
    this.joyValue = { x: 0, y: 0 }; // x=right, y=forward
    this.joyRadius = 58;

    // Look
    this.lookId = null;
    this.lookLast = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };

    // Buttons
    this.jump = false;
    this.sneak = false;
    this.attack = false;
    this.attackPressed = false;
    this.usePressed = false;
    this.flyPressed = false;

    this._lastJumpTap = 0;
    this.enabled = true;

    this._bindJoystick();
    this._bindLook();
    this._bindButtons();
  }

  _bindJoystick() {
    const el = this.els.joystickZone;
    if (!el) return;
    const knob = this.els.joystickKnob;

    const start = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      markTouchEvent();
      const t = e.changedTouches[0];
      this.joyId = t.identifier;
      const rect = el.getBoundingClientRect();
      this.joyOrigin = { x: t.clientX, y: t.clientY };
      this._joyRect = rect;
      if (knob) knob.style.opacity = '1';
      this._moveKnob(0, 0);
    };
    const move = (e) => {
      if (this.joyId == null) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this.joyId) continue;
        let dx = t.clientX - this.joyOrigin.x;
        let dy = t.clientY - this.joyOrigin.y;
        const len = Math.hypot(dx, dy);
        if (len > this.joyRadius) {
          dx = (dx / len) * this.joyRadius;
          dy = (dy / len) * this.joyRadius;
        }
        this.joyValue.x = dx / this.joyRadius;
        this.joyValue.y = -dy / this.joyRadius;
        this._moveKnob(dx, dy);
      }
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          this.joyId = null;
          this.joyValue = { x: 0, y: 0 };
          this._moveKnob(0, 0);
          if (knob) knob.style.opacity = '0.55';
        }
      }
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
  }

  _moveKnob(dx, dy) {
    const knob = this.els.joystickKnob;
    if (!knob) return;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  _bindLook() {
    const el = this.els.lookZone;
    if (!el) return;

    const start = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      markTouchEvent();
      const t = e.changedTouches[0];
      this.lookId = t.identifier;
      this.lookLast = { x: t.clientX, y: t.clientY };
    };
    const move = (e) => {
      if (this.lookId == null) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this.lookId) continue;
        const dx = t.clientX - this.lookLast.x;
        const dy = t.clientY - this.lookLast.y;
        this.lookLast = { x: t.clientX, y: t.clientY };
        this.lookDelta.x += dx * this.sensitivity;
        this.lookDelta.y += dy * this.sensitivity;
      }
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.lookId) {
          this.lookId = null;
        }
      }
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
  }

  _bindButtons() {
    const bind = (el, down, up) => {
      if (!el) return;
      const onDown = (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        markTouchEvent();
        el.classList.add('pressed');
        down();
      };
      const onUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('pressed');
        if (up) up();
      };
      el.addEventListener('touchstart', onDown, { passive: false });
      el.addEventListener('touchend', onUp, { passive: false });
      el.addEventListener('touchcancel', onUp, { passive: false });
      // Maus-Support (für Hybrid-Geräte/Tests) – aber nicht direkt nach Touch
      el.addEventListener('mousedown', (e) => {
        if (wasRecentTouch()) return;
        e.preventDefault();
        el.classList.add('pressed');
        down();
      });
      el.addEventListener('mouseup', (e) => {
        if (wasRecentTouch()) return;
        e.preventDefault();
        el.classList.remove('pressed');
        if (up) up();
      });
    };

    bind(this.els.btnJump, () => {
      this.jump = true;
      const now = performance.now();
      if (now - this._lastJumpTap < 320) {
        this.flyPressed = true;
        this.onAction('doubleJump');
      }
      this._lastJumpTap = now;
    }, () => { this.jump = false; });

    bind(this.els.btnSneak, () => {
      this.sneak = !this.sneak; // Toggle
      this.onAction('sneak');
    }, null);

    bind(this.els.btnFly, () => {
      this.flyPressed = true;
      this.onAction('fly');
    }, null);

    bind(this.els.btnAttack, () => {
      this.attack = true;
      this.attackPressed = true;
      this.onAction('attack');
    }, () => { this.attack = false; });

    bind(this.els.btnPlace, () => {
      this.usePressed = true;
      this.onAction('place');
    }, null);

    bind(this.els.btnInventory, () => this.onAction('inventory'), null);
    bind(this.els.btnMenu, () => this.onAction('menu'), null);
    bind(this.els.btnCraft, () => this.onAction('craft'), null);
    bind(this.els.btnDebug, () => this.onAction('debug'), null);
    bind(this.els.btnChatless ?? null, () => this.onAction('cycleMode'), null);
  }

  /** Gleiche Form wie Input.movement(). */
  movement() {
    return {
      forward: this.joyValue.y,
      right: this.joyValue.x,
      jump: this.jump,
      sneak: this.sneak,
      sprint: Math.hypot(this.joyValue.x, this.joyValue.y) > 0.92,
    };
  }

  consumeLook() {
    const d = { ...this.lookDelta };
    this.lookDelta = { x: 0, y: 0 };
    return d;
  }

  consumePressed() {
    const a = this.attackPressed;
    const u = this.usePressed;
    const f = this.flyPressed;
    this.attackPressed = false;
    this.usePressed = false;
    this.flyPressed = false;
    return { attack: a, use: u, fly: f };
  }
}
