// touch.test.mjs — Touch-Steuerung testen: Joystick, Look-Drag, Buttons, Doppelsprung.
import { TouchControls, isTouchDevice, markTouchEvent, wasRecentTouch, screenRayDirection } from '../src/core/touch.js';

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FEHL:', msg); }
}

// DOM-Stubs mit Event-Capture
function makeEl() {
  const listeners = {};
  return {
    listeners,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: {},
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    dispatch(type, event) {
      for (const fn of listeners[type] || []) fn(event);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 400, right: 300, bottom: 400 }),
  };
}

const makeEvent = (touches) => ({
  preventDefault() {},
  stopPropagation() {},
  changedTouches: touches,
  touches,
});

Object.defineProperty(globalThis, 'navigator', {
  value: { maxTouchPoints: 5, userAgent: 'touch-test' },
  configurable: true,
});
globalThis.window = {
  addEventListener() {},
  matchMedia: () => ({ matches: true }),
  innerWidth: 390,
  innerHeight: 844,
};
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const els = {
  joystickZone: makeEl(),
  joystickKnob: makeEl(),
  lookZone: makeEl(),
  btnJump: makeEl(),
  btnSneak: makeEl(),
  btnFly: makeEl(),
  btnAttack: makeEl(),
  btnPlace: makeEl(),
  btnInventory: makeEl(),
  btnMenu: makeEl(),
  btnCraft: makeEl(),
  btnDebug: makeEl(),
};

const actions = [];
const touch = new TouchControls(els, {
  sensitivity: 0.004,
  onAction: (name) => actions.push(name),
});

// ---- Joystick --------------------------------------------------------------
els.joystickZone.dispatch('touchstart', makeEvent([{ identifier: 1, clientX: 100, clientY: 300 }]));
els.joystickZone.dispatch('touchmove', makeEvent([{ identifier: 1, clientX: 100 + 58, clientY: 300 }]));
let m = touch.movement();
ok(Math.abs(m.right - 1) < 0.01, `Joystick rechts = ${m.right.toFixed(2)} (≈1)`);
ok(Math.abs(m.forward) < 0.01, `Joystick vorwärts = ${m.forward.toFixed(2)} (≈0)`);

els.joystickZone.dispatch('touchmove', makeEvent([{ identifier: 1, clientX: 100, clientY: 300 - 58 }]));
m = touch.movement();
ok(Math.abs(m.forward - 1) < 0.01, `Joystick vorwärts = ${m.forward.toFixed(2)} (≈1)`);

// über die Grenze hinaus begrenzen
els.joystickZone.dispatch('touchmove', makeEvent([{ identifier: 1, clientX: 100 + 300, clientY: 300 - 300 }]));
m = touch.movement();
ok(Math.hypot(m.right, m.forward) <= 1.02, `Joystick begrenzt (len=${Math.hypot(m.right, m.forward).toFixed(2)})`);
ok(m.sprint === true, 'Joystick voll ausgelenkt → Sprint');

els.joystickZone.dispatch('touchend', makeEvent([{ identifier: 1, clientX: 0, clientY: 0 }]));
m = touch.movement();
ok(m.right === 0 && m.forward === 0, 'Joystick zurückgesetzt nach Loslassen');

els.joystickZone.dispatch('touchstart', makeEvent([{ identifier: 13, clientX: 80, clientY: 500 }]));
await new Promise((r) => setTimeout(r, 160));
const joystickMine = touch.minePoint();
ok(joystickMine?.x === 80 && joystickMine?.y === 500,
  'Ruhiger Long-Press funktioniert auch links neben dem Joystick-Knopf');
els.joystickZone.dispatch('touchend', makeEvent([{ identifier: 13, clientX: 80, clientY: 500 }]));

// ---- Look-Drag -------------------------------------------------------------
els.lookZone.dispatch('touchstart', makeEvent([{ identifier: 2, clientX: 300, clientY: 100 }]));
els.lookZone.dispatch('touchmove', makeEvent([{ identifier: 2, clientX: 340, clientY: 110 }]));
const look = touch.consumeLook();
ok(Math.abs(look.x - 40 * 0.004) < 0.001, `Look-Delta X (${look.x.toFixed(4)})`);
ok(Math.abs(look.y - 10 * 0.004) < 0.001, `Look-Delta Y (${look.y.toFixed(4)})`);
const look2 = touch.consumeLook();
ok(look2.x === 0 && look2.y === 0, 'Look-Delta wird konsumiert');
els.lookZone.dispatch('touchend', makeEvent([{ identifier: 2, clientX: 340, clientY: 110 }]));
els.lookZone.dispatch('touchmove', makeEvent([{ identifier: 2, clientX: 400, clientY: 100 }]));
const look3 = touch.consumeLook();
ok(look3.x === 0, 'Kein Look nach Touch-Ende');

// Bildschirmstrahl: Mittelpunkt entspricht Blickrichtung, Randpunkt wird versetzt.
const rayPlayer = {
  yaw: 0,
  pitch: 0,
  lookDir: () => ({ x: 0, y: 0, z: -1 }),
};
const centerRay = screenRayDirection(rayPlayer, { x: 195, y: 422 }, 390, 844, 75);
ok(Math.abs(centerRay.x) < 0.001 && Math.abs(centerRay.y) < 0.001 && centerRay.z < -0.999,
  'Bildschirmmitte zielt geradeaus');
const upperRightRay = screenRayDirection(rayPlayer, { x: 292.5, y: 211 }, 390, 844, 75);
ok(upperRightRay.x > 0 && upperRightRay.y > 0 && upperRightRay.z < 0,
  'Touchposition oben rechts erzeugt korrekten Weltstrahl');
ok(Math.abs(Math.hypot(upperRightRay.x, upperRightRay.y, upperRightRay.z) - 1) < 0.001,
  'Touch-Strahl ist normalisiert');

// Long-Press zum Abbauen (ab 140 ms); ein Wisch bleibt reine Blicksteuerung.
els.lookZone.dispatch('touchstart', makeEvent([{ identifier: 12, clientX: 280, clientY: 250 }]));
await new Promise((r) => setTimeout(r, 160));
const minePoint = touch.minePoint();
ok(minePoint?.x === 280 && minePoint?.y === 250, 'Stillhalten aktiviert Mobile-Long-Press');
els.lookZone.dispatch('touchmove', makeEvent([{ identifier: 12, clientX: 300, clientY: 250 }]));
ok(touch.minePoint() === null, 'Wischen dreht Blick, löst keinen Abbau aus');
els.lookZone.dispatch('touchend', makeEvent([{ identifier: 12, clientX: 300, clientY: 250 }]));
ok(touch.minePoint() === null, 'Loslassen beendet Mobile-Long-Press');

// ---- Buttons ---------------------------------------------------------------
els.btnAttack.dispatch('touchstart', makeEvent([{ identifier: 3, clientX: 10, clientY: 10 }]));
ok(touch.attack === true, 'Angriff gehalten');
let pressed = touch.consumePressed();
ok(pressed.attack === true, 'attackPressed gesetzt');
els.btnAttack.dispatch('touchend', makeEvent([{ identifier: 3, clientX: 10, clientY: 10 }]));
ok(touch.attack === false, 'Angriff losgelassen');

els.btnPlace.dispatch('touchstart', makeEvent([{ identifier: 4, clientX: 10, clientY: 10 }]));
els.btnPlace.dispatch('touchend', makeEvent([{ identifier: 4, clientX: 10, clientY: 10 }]));
pressed = touch.consumePressed();
ok(pressed.use === true, 'Platzieren ausgelöst');

// Sprung + Doppelsprung (Fliegen)
els.btnJump.dispatch('touchstart', makeEvent([{ identifier: 5, clientX: 10, clientY: 10 }]));
ok(touch.jump === true, 'Sprung gehalten');
els.btnJump.dispatch('touchend', makeEvent([{ identifier: 5, clientX: 10, clientY: 10 }]));
ok(touch.jump === false, 'Sprung losgelassen');
// Zweiter Tap innerhalb von 320ms
els.btnJump.dispatch('touchstart', makeEvent([{ identifier: 6, clientX: 10, clientY: 10 }]));
ok(actions.includes('doubleJump'), 'Doppelsprung erkannt');

// Sneak-Toggle
els.btnSneak.dispatch('touchstart', makeEvent([{ identifier: 7, clientX: 10, clientY: 10 }]));
ok(touch.sneak === true, 'Schleichen an');
els.btnSneak.dispatch('touchstart', makeEvent([{ identifier: 8, clientX: 10, clientY: 10 }]));
ok(touch.sneak === false, 'Schleichen aus (Toggle)');

// Fly-Button
els.btnFly.dispatch('touchstart', makeEvent([{ identifier: 9, clientX: 10, clientY: 10 }]));
ok(actions.includes('fly'), 'Fliegen-Button ausgelöst');

// Inventar & Menü
els.btnInventory.dispatch('touchstart', makeEvent([{ identifier: 10, clientX: 10, clientY: 10 }]));
els.btnMenu.dispatch('touchstart', makeEvent([{ identifier: 11, clientX: 10, clientY: 10 }]));
ok(actions.includes('inventory'), 'Inventar-Button');
ok(actions.includes('menu'), 'Menü-Button');

// ---- Touch/Emulated-Maus ---------------------------------------------------
markTouchEvent();
ok(wasRecentTouch() === true, 'wasRecentTouch nach markTouchEvent');
await new Promise((r) => setTimeout(r, 750));
ok(wasRecentTouch() === false, 'wasRecentTouch läuft ab');

ok(isTouchDevice() === true, 'isTouchDevice erkennt Touch-Stubs');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
