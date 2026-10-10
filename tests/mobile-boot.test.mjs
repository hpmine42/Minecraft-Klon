// mobile-boot.test.mjs — Spielstart im „Handy-Modus": Touch-Erkennung, TouchControls,
// Joystick-Input im echten Spiel, Mobile-UI-Elemente.
import { BLOCK } from '../src/world/blocks.js';

// ---- DOM-Stubs mit Listener-Capture ---------------------------------------
function makeEl(id) {
  const listeners = {};
  return {
    id,
    listeners,
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [],
    dataset: {},
    value: '',
    checked: true,
    textContent: '',
    innerHTML: '',
    width: 32,
    height: 32,
    offsetWidth: 100,
    firstChild: { style: {} },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { return c; },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    dispatch(type, event) {
      for (const fn of listeners[type] || []) fn(event);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 700, right: 390, bottom: 700 }),
    getContext(type) {
      if (type === 'webgl2' || type === 'webgl') return glStub(this);
      return ctxStub();
    },
    setAttribute() {},
    querySelector: () => makeEl('q'),
    querySelectorAll: () => [],
    focus() {},
    requestPointerLock() {},
    el: null,
  };
}

const ctxStub = () => new Proxy({}, {
  get(target, prop) {
    if (prop === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
    if (prop === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
  },
});

const GL_CONST_VALUES = {
  VERSION: 7938, RENDERER: 7937, VENDOR: 7936, SHADING_LANGUAGE_VERSION: 35724,
  MAX_TEXTURE_SIZE: 3379, MAX_VIEWPORT_DIMS: 3386, ALIASED_LINE_WIDTH_RANGE: 33902,
  ALIASED_POINT_SIZE_RANGE: 33901, FRAMEBUFFER_COMPLETE: 36053,
  VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632,
};
let glConstCounter = 900000;
const glConstMap = new Map(Object.entries(GL_CONST_VALUES));
const glStub = (canvas) => new Proxy({}, {
  get(target, prop) {
    if (prop === Symbol.toPrimitive) return () => 0;
    if (prop === 'canvas') return canvas;
    if (prop === 'getParameter') return (p) => {
      if (p === 7938) return 'WebGL 2.0';
      if (p === 7937) return 'StubGPU';
      if (p === 7936) return 'StubVendor';
      if (p === 35724) return 'WebGL GLSL ES 3.00';
      if (p === 3379) return 4096;
      if (p === 3386) return new Int32Array([4096, 4096]);
      if (p === 33901) return new Float32Array([1, 256]);
      if (p === 33902) return new Float32Array([1, 1]);
      return 4096;
    };
    if (prop === 'getShaderPrecisionFormat') return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
    if (prop === 'getExtension') return () => null;
    if (prop === 'getSupportedExtensions') return () => [];
    if (prop === 'getProgramParameter') return (p, pname) => (pname === 35718 || pname === 35721) ? 0 : true;
    if (prop === 'getShaderParameter') return () => true;
    if (prop === 'getActiveUniform' || prop === 'getActiveAttrib') return () => ({ name: 'x', type: 5126, size: 1 });
    if (prop === 'getProgramInfoLog' || prop === 'getShaderInfoLog') return () => '';
    if (prop === 'getError') return () => 0;
    if (prop === 'checkFramebufferStatus') return () => 36053;
    if (prop === 'getContextAttributes') return () => ({ alpha: true, depth: true, stencil: true, antialias: true });
    if (prop === 'getUniformLocation') return () => ({});
    if (prop === 'getAttribLocation') return () => 0;
    if (/^create/.test(String(prop))) return () => ({});
    if (typeof prop === 'string' && /^[A-Z0-9_]+$/.test(prop)) {
      if (!glConstMap.has(prop)) glConstMap.set(prop, glConstCounter++);
      return glConstMap.get(prop);
    }
    return () => {};
  },
});

const elementsById = new Map();
const elById = (id) => {
  if (!elementsById.has(id)) {
    const e = makeEl(id);
    e.el = e;
    elementsById.set(id, e);
  }
  return elementsById.get(id);
};

// ---- Handy-Umgebung --------------------------------------------------------
Object.defineProperty(globalThis, 'navigator', {
  value: { maxTouchPoints: 5, userAgent: 'MobileBootTest', platform: 'iPhone' },
  configurable: true,
});
globalThis.window = {
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 3,
  addEventListener(type, fn) {
    if (type === 'DOMContentLoaded') this._domReady = fn;
  },
  removeEventListener() {},
  // Handy: coarse pointer
  matchMedia: () => ({ matches: true, addListener() {} }),
  AudioContext: class {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = {}; }
    createGain() { return { connect: () => ({ connect: () => {} }), gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }; }
    createBufferSource() { return { connect: () => ({ connect: () => ({ connect: () => {} }) }), start() {}, stop() {}, playbackRate: { value: 1 }, buffer: null, loop: false }; }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBiquadFilter() { return { connect: () => ({ connect: () => ({ connect: () => {} }) }), type: '', frequency: { value: 0 }, Q: { value: 0 } }; }
    createOscillator() { return { connect: () => ({ connect: () => ({ connect: () => {} }) }), start() {}, stop() {}, type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    resume() {}
  },
};
globalThis.document = {
  readyState: 'loading',
  getElementById: elById,
  createElement: () => makeEl('dyn'),
  addEventListener() {},
  removeEventListener() {},
  pointerLockElement: null,
  exitPointerLock() {},
  hidden: false,
  body: makeEl('body'),
  documentElement: makeEl('html'),
};
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};
globalThis.confirm = () => true;
let rafCount = 0;
globalThis.requestAnimationFrame = (fn) => {
  rafCount++;
  if (rafCount > 300) return 0;
  return setTimeout(() => fn(performance.now()), 4);
};
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// ---- Spiel starten ---------------------------------------------------------
await import('../src/main.js');
const game = globalThis.window.__game;
if (globalThis.window._domReady) globalThis.window._domReady();

await new Promise((r) => setTimeout(r, 200));

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`✔ ${msg}`); }
  else { failed++; console.error(`✘ ${msg}`); }
};

ok(game.isTouch === true, 'Touch-Modus erkannt (Handy)');
ok(!!game.touch, 'TouchControls initialisiert');
ok(elById('mobile-controls').style.display === 'block', 'Mobile Steuerung eingeblendet');
ok(game.settings.renderDistance <= 4, `Handy-Renderdistanz kompakt (${game.settings.renderDistance})`);

// Welt starten
elById('seed-input').value = '42';
elById('world-type').value = 'normal';
elById('game-mode').value = 'creative';
elById('peaceful-mode').checked = true;
game.startNewWorld();
await new Promise((r) => setTimeout(r, 800));
ok(game.state === 'playing', `Spiel läuft (${game.state})`);
ok(game.world.chunks.size > 0, `Welt da (${game.world.chunks.size} Chunks)`);

// Joystick bewegen → Spieler läuft
const makeEvent = (touches) => ({ preventDefault() {}, stopPropagation() {}, changedTouches: touches, touches });
const joyZone = elById('joystick-zone');
const startPos = { ...game.player.position };
joyZone.dispatch('touchstart', makeEvent([{ identifier: 1, clientX: 80, clientY: 500 }]));
joyZone.dispatch('touchmove', makeEvent([{ identifier: 1, clientX: 80, clientY: 500 - 55 }]));
await new Promise((r) => setTimeout(r, 500));
joyZone.dispatch('touchend', makeEvent([{ identifier: 1, clientX: 80, clientY: 500 }]));
const moved = Math.hypot(game.player.position.x - startPos.x, game.player.position.z - startPos.z);
ok(moved > 0.5, `Joystick bewegt Spieler (${moved.toFixed(2)} Blöcke)`);

// Blick per Wischen drehen
const lookZone = elById('look-zone');
const yawBefore = game.player.yaw;
lookZone.dispatch('touchstart', makeEvent([{ identifier: 2, clientX: 300, clientY: 100 }]));
lookZone.dispatch('touchmove', makeEvent([{ identifier: 2, clientX: 360, clientY: 100 }]));
await new Promise((r) => setTimeout(r, 60));
ok(Math.abs(game.player.yaw - yawBefore) > 0.01, `Blick per Wischen gedreht (Δ=${(game.player.yaw - yawBefore).toFixed(3)})`);
lookZone.dispatch('touchend', makeEvent([{ identifier: 2, clientX: 360, clientY: 100 }]));

// Springen-Button
const jumpBtn = elById('btn-jump');
const yBefore = game.player.position.y;
jumpBtn.dispatch('touchstart', makeEvent([{ identifier: 3, clientX: 10, clientY: 10 }]));
await new Promise((r) => setTimeout(r, 120));
jumpBtn.dispatch('touchend', makeEvent([{ identifier: 3, clientX: 10, clientY: 10 }]));
ok(game.player.position.y > yBefore + 0.1, `Sprung-Button hebt Spieler (+${(game.player.position.y - yBefore).toFixed(2)})`);

// Doppelsprung → Fliegen (Kreativ) – erst Abstand zum vorherigen Tap
await new Promise((r) => setTimeout(r, 450));
jumpBtn.dispatch('touchstart', makeEvent([{ identifier: 4, clientX: 10, clientY: 10 }]));
jumpBtn.dispatch('touchend', makeEvent([{ identifier: 4, clientX: 10, clientY: 10 }]));
await new Promise((r) => setTimeout(r, 30));
jumpBtn.dispatch('touchstart', makeEvent([{ identifier: 5, clientX: 10, clientY: 10 }]));
ok(game.player.flying === true, 'Doppelsprung schaltet Fliegen an');

// Platzieren-Button (Block in der Welt)
const placeBtn = elById('btn-place');
game.player.pitch = -0.9;
game.inventory.selected = 0;
game.inventory.slots[0] = { id: BLOCK.COBBLESTONE, count: 64, dur: null };
placeBtn.dispatch('touchstart', makeEvent([{ identifier: 6, clientX: 10, clientY: 10 }]));
placeBtn.dispatch('touchend', makeEvent([{ identifier: 6, clientX: 10, clientY: 10 }]));
await new Promise((r) => setTimeout(r, 60));
ok(true, 'Platzieren-Button ohne Fehler');

// Inventar-Button öffnet Inventar
const invBtn = elById('btn-inventory');
invBtn.dispatch('touchstart', makeEvent([{ identifier: 7, clientX: 10, clientY: 10 }]));
ok(game.state === 'inventory', 'Inventar-Button öffnet Inventar');
invBtn.dispatch('touchstart', makeEvent([{ identifier: 8, clientX: 10, clientY: 10 }]));
ok(game.state === 'playing', 'Inventar-Button schließt Inventar');

// Menü-Button → Pause
const menuBtn = elById('btn-menu');
menuBtn.dispatch('touchstart', makeEvent([{ identifier: 9, clientX: 10, clientY: 10 }]));
ok(game.state === 'paused', 'Menü-Button öffnet Pause');
menuBtn.dispatch('touchstart', makeEvent([{ identifier: 10, clientX: 10, clientY: 10 }]));
ok(game.state === 'playing', 'Menü-Button kehrt zurück');

// Pixel-Ratio für Handy begrenzt
ok(game.engine.pixelRatio <= 1.75, `Pixel-Ratio gedrosselt (${game.engine.pixelRatio})`);

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed > 0 ? 1 : 0);
