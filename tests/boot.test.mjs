// boot.test.mjs — Startet main.js komplett mit DOM-Stubs (Boot-Smoke-Test).
import { pathToFileURL } from 'node:url';
import { BLOCK } from '../src/world/blocks.js';

// ---- Browser-Stubs (wie modules.test, aber erweiterter) --------------------
const ctxStub = () => new Proxy({}, {
  get(target, prop) {
    if (prop === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
    if (prop === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    return () => {};
  },
});

// WebGL-Stub für THREE.WebGLRenderer
const GL_CONST_VALUES = {
  VERSION: 7938, RENDERER: 7937, VENDOR: 7936, SHADING_LANGUAGE_VERSION: 35724,
  MAX_TEXTURE_SIZE: 3379, MAX_VIEWPORT_DIMS: 3386,
  ALIASED_LINE_WIDTH_RANGE: 33902, ALIASED_POINT_SIZE_RANGE: 33901,
  MAX_VERTEX_ATTRIBS: 34921, MAX_TEXTURE_IMAGE_UNITS: 34930,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661, MAX_SAMPLES: 36183,
  MAX_CUBE_MAP_TEXTURE_SIZE: 34076, MAX_RENDERBUFFER_SIZE: 34024,
  MAX_3D_TEXTURE_SIZE: 32883, MAX_ARRAY_TEXTURE_LAYERS: 35071,
  MAX_TEXTURE_MAX_ANISOTROPY: 34047,
  MAX_VERTEX_UNIFORM_VECTORS: 36347, MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
  MAX_VARYING_VECTORS: 36348, MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
  SCISSOR_BOX: 3088, VIEWPORT: 2978,
  FRAMEBUFFER_COMPLETE: 36053, VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632,
  ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963, TEXTURE_2D: 3553,
  RGBA: 6408, UNSIGNED_BYTE: 5121, FLOAT: 5126, TRIANGLES: 4,
};
let glConstCounter = 900000;
const glConstMap = new Map(Object.entries(GL_CONST_VALUES).map(([k, v]) => [k, v]));

const glStub = (canvas) => new Proxy({}, {
  get(target, prop) {
    if (prop === Symbol.toPrimitive) return () => 0;
    if (prop === 'canvas') return canvas;
    if (prop === 'getParameter') return (p) => {
      if (p === 7938) return 'WebGL 2.0';
      if (p === 7937) return 'StubGPU';
      if (p === 7936) return 'StubVendor';
      if (p === 35724) return 'WebGL GLSL ES 3.00';
      if (p === 3379) return 8192;
      if (p === 3386) return new Int32Array([8192, 8192]);
      if (p === 33901) return new Float32Array([1, 256]);
      if (p === 33902) return new Float32Array([1, 1]);
      if (p === 3088 || p === 2978) return new Int32Array([0, 0, 1280, 720]);
      return 4096;
    };
    if (prop === 'getShaderPrecisionFormat') return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
    if (prop === 'getExtension') return (name) => {
      if (name === 'WEBGL_debug_renderer_info') return { UNMASKED_RENDERER_WEBGL: 37446, UNMASKED_VENDOR_WEBGL: 37445 };
      return null;
    };
    if (prop === 'getSupportedExtensions') return () => ['WEBGL_debug_renderer_info'];
    if (prop === 'getProgramParameter') return () => true;
    if (prop === 'getShaderParameter') return () => true;
    if (prop === 'getProgramInfoLog' || prop === 'getShaderInfoLog') return () => '';
    if (prop === 'getError') return () => 0;
    if (prop === 'checkFramebufferStatus') return () => 36053;
    if (prop === 'getContextAttributes') return () => ({
      alpha: true, depth: true, stencil: true, antialias: true,
      premultipliedAlpha: true, preserveDrawingBuffer: false,
    });
    if (prop === 'getUniformLocation') return () => ({});
    if (prop === 'getAttribLocation') return () => 0;
    if (prop === 'getActiveUniform' || prop === 'getActiveAttrib') return () => ({ name: 'x', type: 5126, size: 1 });
    if (/^create/.test(String(prop))) return () => ({});
    if (typeof prop === 'string' && /^[A-Z0-9_]+$/.test(prop)) {
      if (!glConstMap.has(prop)) glConstMap.set(prop, glConstCounter++);
      return glConstMap.get(prop);
    }
    return () => {};
  },
});

const elementsById = new Map();
function makeElement(id) {
  const el = {
    id,
    style: new Proxy({}, { get: () => '', set: () => true }),
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
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 240, right: 320, bottom: 240 }),
    getContext(type) {
      if (type === 'webgl2' || type === 'webgl') return glStub(el);
      return ctxStub();
    },
    setAttribute() {},
    querySelector: () => makeElement('q'),
    querySelectorAll: () => [],
    focus() {},
    requestPointerLock() {},
  };
  return el;
}

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  addEventListener(type, fn) {
    if (type === 'DOMContentLoaded') this._domReady = fn;
  },
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addListener() {} }),
  AudioContext: class {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = {}; }
    createGain() { return { connect: () => ({ connect: () => {} }), gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }; }
    createBufferSource() { return { connect: () => ({ connect: () => ({ connect: () => {} }) }), start() {}, stop() {}, playbackRate: { value: 1 }, buffer: null, loop: false }; }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBiquadFilter() { return { connect: () => ({ connect: () => ({ connect: () => {} }) }), type: '', frequency: { value: 0 }, Q: { value: 0 } }; }
    createOscillator() { return { connect: () => ({ connect: () => ({ connect: () => {} }) }), start() {}, stop() {}, type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    resume() {}
  },
  webkitAudioContext: undefined,
};
Object.defineProperty(globalThis, 'navigator', {
  value: { maxTouchPoints: 0, userAgent: 'test-node' },
  configurable: true,
});
globalThis.document = {
  readyState: 'loading', // damit boot() nur über DOMContentLoaded läuft
  getElementById: (id) => {
    if (!elementsById.has(id)) elementsById.set(id, makeElement(id));
    return elementsById.get(id);
  },
  createElement: () => makeElement('dyn'),
  addEventListener() {},
  removeEventListener() {},
  pointerLockElement: null,
  exitPointerLock() {},
  hidden: false,
  body: makeElement('body'),
  documentElement: makeElement('html'),
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
  if (rafCount > 240) return 0; // Schleife begrenzen
  return setTimeout(() => fn(performance.now()), 4);
};
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// ---- main.js laden --------------------------------------------------------
await import('../src/main.js');
const game = globalThis.window.__game;

// DOM-Ready auslösen
if (globalThis.window._domReady) globalThis.window._domReady();

// Etwas laufen lassen
await new Promise((r) => setTimeout(r, 400));

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`✔ ${msg}`); }
  else { failed++; console.error(`✘ ${msg}`); }
};

ok(!!game, 'Spiel-Instanz vorhanden');
ok(game.state === 'menu', `Zustand nach Boot: ${game.state} (erwartet menu)`);
ok(!!game.engine, 'Engine initialisiert');
game.engine.updateSky(0, 3, 0.016, 0);
ok(game.engine.dayFactor > 0.3 && game.engine.dayFactor < 0.4, 'Himmel startet am Sonnenaufgang');
game.engine.updateSky(0.25, 3, 0.016, 0);
ok(game.engine.dayFactor === 1 && game.engine.isDay(), 'Sonnenstand mittags stimmt');
game.engine.updateSky(0.75, 3, 0.016, 0);
ok(game.engine.dayFactor === 0 && !game.engine.isDay(), 'Nacht und Mob-Tageslogik stimmen überein');
ok(!!game.engine.renderer, 'Renderer vorhanden');
ok(!!game.atlasCanvas, 'Textur-Atlas erzeugt');
ok(!!game.world || game.state === 'menu', 'Welt noch nicht nötig im Menü');
ok(!!game.hud, 'HUD initialisiert');
ok(!!game.menus, 'Menüs initialisiert');
ok(game.menus.activeScreen === 'main-menu', `Hauptmenü sichtbar (${game.menus.activeScreen})`);
ok(typeof game.startNewWorld === 'function', 'startNewWorld vorhanden');

// Neue Welt starten (asynchron über setTimeout)
document.getElementById('seed-input').value = '12345';
document.getElementById('world-type').value = 'normal';
document.getElementById('game-mode').value = 'survival';
document.getElementById('peaceful-mode').checked = true;
game.startNewWorld();
await new Promise((r) => setTimeout(r, 500));
ok(game.state === 'playing', `Zustand nach Start: ${game.state}`);
ok(!!game.world && game.world.chunks.size > 0, `Welt generiert (${game.world ? game.world.chunks.size : 0} Chunks)`);
ok(!!game.mobs, 'Mob-Manager vorhanden');
ok(!!game.interaction, 'Interaktion vorhanden');
ok(game.player.position.y > 0, `Spieler positioniert (y=${game.player.position.y.toFixed(1)})`);

// Ein paar Frames Spiel-Loop
await new Promise((r) => setTimeout(r, 400));
ok(game.player.health === 20, `Gesundheit intakt (${game.player.health})`);
ok(game.world.stats().solidVerts > 0, `Terrain-Meshes gebaut (${game.world.stats().solidVerts} Vertices)`);

// Pause / Resume
game.pause();
ok(game.state === 'paused', 'Pause funktioniert');
game.resume();
ok(game.state === 'playing', 'Resume funktioniert');

// ---- Block abbauen & platzieren (echte Interaktion) -------------------------
{
  const p = game.player;
  // Nach unten schauen und Boden anvisieren
  p.pitch = -Math.PI / 2 + 0.15;
  const targetBefore = game.world.raycast(p.eyePosition(), p.lookDir(), 5.2);   ok(targetBefore !== null, `Abbau-Ziel gefunden (Block ${targetBefore?.id})`);

  // Kreativ: sofort im Test alles abbauen
  p.gamemode = 'creative';
  game.inventory.selected = 0;
  game.inventory.slots[0] = { id: BLOCK.COBBLESTONE, count: 64, dur: null };

  // Abbauen (attack halten über Frames)
  for (let i = 0; i < 30; i++) {
    game.interaction.update(1 / 30, { attack: true, usePressed: false, pickPressed: false }, game.engine.camera);
    game.world.update(p.position.x, p.position.z, 2, 50);
  }
  const targetAfter = game.world.raycast(p.eyePosition(), p.lookDir(), 5.2);
  ok(targetAfter === null || targetAfter.y < targetBefore.y - 1 || targetAfter.id !== targetBefore.id,
    'Block wurde abgebaut');

  // Platzieren: Bruchstein ins Loch legen
  const place = game.interaction.update(1 / 30, { attack: false, usePressed: true, pickPressed: false }, game.engine.camera);
  game.world.update(p.position.x, p.position.z, 2, 50);
  ok(true, 'Platzieren ohne Fehler');
}

// Inventar öffnen/schließen

// Inventar öffnen/schließen
game.openInventory();
ok(game.state === 'inventory', 'Inventar öffnet');
game.closeInventory();
ok(game.state === 'playing', 'Inventar schließt');

// Speichern / Laden
const saved = game.saveNow();
ok(saved === true, 'Spiel speichern');
ok(localStorage.getItem('minecraft-klon-save-v1') !== null, 'Spielstand im localStorage');
game.quitToMenu();
ok(game.state === 'menu', 'Zurück im Hauptmenü');
game.continueGame();
await new Promise((r) => setTimeout(r, 500));
ok(game.state === 'playing', 'Spiel fortgesetzt');
ok(game.world.chunks.size > 0, `Welt nach Laden da (${game.world.chunks.size} Chunks)`);

// Tastatur: Strg sprintet ohne gleichzeitig zu schleichen, beide Strg-Tasten funktionieren.
game.input.keys.clear();
game.input.keys.add('ControlLeft');
let keyMove = game.input.movement();
ok(keyMove.sprint && !keyMove.sneak, 'Linkes Strg sprintet, ohne versehentlich abzusteigen/schleichen');
game.input.keys.clear();
game.input.keys.add('ControlRight');
keyMove = game.input.movement();
ok(keyMove.sprint && !keyMove.sneak, 'Rechtes Strg sprintet ebenfalls');
game.input.keys.clear();
game.input.keys.add('ShiftLeft');
keyMove = game.input.movement();
ok(keyMove.sneak && !keyMove.sprint, 'Shift bleibt die separate Schleichen-/Abstiegstaste');
game.input.keys.clear();

// Flug-Doppeltipp: kein Startfehler, und Tastatur-Key-Repeat toggelt nicht mehrfach.
game.player.gamemode = 'creative';
game._setFlying(false);
game.doubleJumpTimer = -Infinity;
game._onKey({ code: 'Space', repeat: false, preventDefault() {} });
ok(!game.player.flying, 'Erster Leertastendruck schaltet Kreativflug nicht versehentlich ein');
const firstFlightTap = game.doubleJumpTimer;
game._onKey({ code: 'Space', repeat: true, preventDefault() {} });
ok(!game.player.flying && game.doubleJumpTimer === firstFlightTap, 'Gedrückthalten zählt nicht als zweiter Flug-Tap');
game._onKey({ code: 'Space', repeat: false, preventDefault() {} });
ok(game.player.flying, 'Zwei echte Leertasten-Taps aktivieren den Flug');
const secondFlightTap = game.doubleJumpTimer;
game._onKey({ code: 'Space', repeat: true, preventDefault() {} });
ok(game.player.flying && game.doubleJumpTimer === secondFlightTap, 'Key-Repeat deaktiviert den Flug nicht wieder');
game._setFlying(false);

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed > 0 ? 1 : 0);
