// mobile-boot.test.mjs — Spielstart im „Handy-Modus": Touch-Erkennung, TouchControls,
// Joystick-Input im echten Spiel, Mobile-UI-Elemente.
import { BLOCK } from '../src/world/blocks.js';

// ---- DOM-Stubs mit Listener-Capture ---------------------------------------
function makeEl(id) {
  const listeners = {};
  return {
    id,
    listeners,
    style: { setProperty() {} },
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
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
    removeChild(c) { return c; },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    dispatch(type, event) {
      if (event) event.currentTarget = this;
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
    setPointerCapture(pointerId) { this.capturedPointerId = pointerId; },
    closest(selector) {
      for (let el = this; el; el = el.parentElement) {
        if (selector === '.inv-slot' && el.dataset?.slotKind) return el;
      }
      return null;
    },
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
  // Handy: Touch + Pointer Events wie in modernen mobilen Browsern.
  PointerEvent: class PointerEvent {},
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
const documentListeners = {};
globalThis.document = {
  readyState: 'loading',
  getElementById: elById,
  createElement: () => makeEl('dyn'),
  addEventListener(type, fn) { (documentListeners[type] ||= []).push(fn); },
  removeEventListener() {},
  dispatch(type, event) { for (const fn of documentListeners[type] || []) fn(event); },
  elementFromPoint() { return this._pointElement || null; },
  pointerLockElement: null,
  fullscreenElement: null,
  exitFullscreen() { this.fullscreenElement = null; },
  exitPointerLock() {},
  hidden: false,
  body: makeEl('body'),
  documentElement: makeEl('html'),
};
globalThis.document.documentElement.requestFullscreen = async function requestFullscreen() {
  globalThis.document.fullscreenElement = this;
};
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};
globalThis.confirm = () => true;
let rafRunning = true;
globalThis.requestAnimationFrame = (fn) => {
  if (!rafRunning) return 0;
  return setTimeout(() => { if (rafRunning) fn(performance.now()); }, 4);
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
ok(game.particles.quality === 'low' && game.particles.maxParticles === 180,
  'Mobile Standardqualität begrenzt Partikel ohne die Effekte abzuschalten');

// Joystick bewegen → Spieler läuft
const makeEvent = (touches) => ({ preventDefault() {}, stopPropagation() {}, changedTouches: touches, touches });
const makePointerEvent = (pointerId, clientX, clientY) => ({
  pointerId, pointerType: 'touch', isPrimary: true, clientX, clientY,
  preventDefault() {}, stopPropagation() {},
});
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
jumpBtn.dispatch('touchend', makeEvent([{ identifier: 5, clientX: 10, clientY: 10 }]));
game.player.flying = true; // Im Kreativflug bleibt die Testposition stabil.
game.player.velocity.x = game.player.velocity.y = game.player.velocity.z = 0;

// Platzieren-Button (Block in der Welt)
const placeBtn = elById('btn-place');
game.player.pitch = -0.9;
game.inventory.selected = 0;
game.inventory.slots[0] = { id: BLOCK.COBBLESTONE, count: 64, dur: null };
placeBtn.dispatch('touchstart', makeEvent([{ identifier: 6, clientX: 10, clientY: 10 }]));
placeBtn.dispatch('touchend', makeEvent([{ identifier: 6, clientX: 10, clientY: 10 }]));
await new Promise((r) => setTimeout(r, 60));
ok(true, 'Platzieren-Button ohne Fehler');

// Mobile Pocket-Edition-Stil: ruhiger Long-Press auf eine Pflanze baut sie ab
// (Touchposition wird auf einen Bildschirm-Strahl projiziert, nicht nur aufs Fadenkreuz).
game.player.yaw = 0;
game.player.pitch = 0;
const eye = game.player.eyePosition();
const targetBlock = {
  x: Math.floor(game.player.position.x),
  y: Math.floor(eye.y),
  z: Math.floor(game.player.position.z) - 3,
};
game.world.setBlock(targetBlock.x, targetBlock.y, targetBlock.z, BLOCK.DIRT);
// Survival bricht schrittweise ab; der folgende Test prüft deshalb auch die Riss-Kontur.
game.player.gamemode = 'survival';
const directRay = game.world.raycast(eye, game.player.lookDir(), 5.2);
ok(directRay?.id === BLOCK.DIRT, 'Testblock liegt im Blickfeld');
const raycastMob = game.mobs.raycastMob;
game.mobs.raycastMob = () => null; // deterministisch auf den Block fokussieren
const interactionUpdate = game.interaction.update.bind(game.interaction);
const outlineUpdate = game.blockOutline.update.bind(game.blockOutline);
let mineFrames = 0;
let outlineShownWhileMining = false;
game.interaction.update = (dt, actions, camera) => {
  if (actions.attack && actions.attackDirection) mineFrames++;
  return interactionUpdate(dt, actions, camera);
};
game.blockOutline.update = (hit) => {
  outlineUpdate(hit);
  if (mineFrames > 0 && hit?.x === targetBlock.x && hit?.y === targetBlock.y && hit?.z === targetBlock.z) {
    outlineShownWhileMining ||= game.blockOutline.mesh.visible;
  }
};
lookZone.dispatch('touchstart', makeEvent([{ identifier: 12, clientX: 195, clientY: 422 }]));
await new Promise((r) => setTimeout(r, 760));
lookZone.dispatch('touchend', makeEvent([{ identifier: 12, clientX: 195, clientY: 422 }]));
game.mobs.raycastMob = raycastMob;
game.interaction.update = interactionUpdate;
game.blockOutline.update = outlineUpdate;
ok(mineFrames > 0, 'Mobile-Long-Press wird im Spiel als gehaltener Abbau verarbeitet');
ok(outlineShownWhileMining, 'Zielkontur bleibt beim mobilen Long-Press auf dem Block sichtbar');
ok(game.world.getBlock(targetBlock.x, targetBlock.y, targetBlock.z) === BLOCK.AIR,
  'Gedrückthalten auf dem Block baut ihn direkt ab');
game.player.gamemode = 'creative';

// Inventar-Button öffnet Inventar
const invBtn = elById('btn-inventory');
invBtn.dispatch('touchstart', makeEvent([{ identifier: 7, clientX: 10, clientY: 10 }]));
ok(game.state === 'inventory', 'Inventar-Button öffnet Inventar');
ok(game.menus.craftingMode === 'player' && game.menus.craftGrid.length === 4
  && game.menus.craftSlotEls[4].el.style.display === 'none',
'Spielerinventar zeigt exakt vier 2×2-Crafting-Slots');
let inventoryWorldTicks = 0;
const playingUpdate = game._updatePlaying;
game._updatePlaying = function (dt) {
  if (this.state === 'inventory') inventoryWorldTicks++;
  return playingUpdate.call(this, dt);
};
await new Promise((r) => setTimeout(r, 40));
game._updatePlaying = playingUpdate;
ok(inventoryWorldTicks > 0, 'Welt, Spielerphysik und Mobs laufen auch bei offenem Inventar weiter');
ok(game.menus.transferControls.parentElement === game.menus.els['inventory-body']
  && game.menus.els['inventory-body'].children[0] === game.menus.transferControls,
  'Einzel-Item-Schalter sitzt sichtbar am Anfang des Inventars');
ok(game.menus.recipeListEl.style.display === 'none',
'Rezeptliste ist mobil zunächst eingeklappt, damit das Inventar ohne Scrollen passt');
game.menus.recipeBookToggle.dispatch('click', makeEvent([]));
const recipeBookExpanded = game.menus.recipeListEl.style.display !== 'none';
game.menus.recipeBookToggle.dispatch('click', makeEvent([]));
ok(recipeBookExpanded && game.menus.recipeListEl.style.display === 'none',
'Rezeptbuch lässt sich bei Bedarf öffnen und wieder platzsparend schließen');

// Item mit einem Finger aus dem Inventar direkt ins 2×2-Spielercraftingfeld ziehen.
game.inventory.slots[9] = { id: BLOCK.LOG, count: 1, dur: null };
game.menus.refreshInventory();
const logSlot = game.menus.invSlotEls.find((slot) => slot.index === 9);
const craftTarget = game.menus.craftSlotEls[0];
logSlot.el.dispatch('pointerdown', makePointerEvent(20, 100, 300));
ok(logSlot.el.capturedPointerId === 20, 'Mobile Crafting-Drag übernimmt den Pointer bis zum Loslassen');
document._pointElement = craftTarget.canvas; // Browser elementFromPoint trifft meist das Slot-Icon.
document.dispatch('pointermove', makePointerEvent(20, 180, 380));
document.dispatch('pointerup', makePointerEvent(20, 180, 380));
ok(game.inventory.slots[9] === null && game.menus.craftGrid[0]?.id === BLOCK.LOG && game.menus.heldStack === null,
  'Mobiles Drag-and-Drop verschiebt den Gegenstand ohne Duplikat ins Craftingfeld');
ok(game.menus.resultSlotEl.stack?.id === BLOCK.PLANKS,
  'Crafting-Ergebnis wird nach dem mobilen Ablegen aktualisiert');

// Die bisherige Zwei-Tap-Bedienung bleibt neben Drag-and-Drop verfügbar.
game.inventory.slots[10] = { id: BLOCK.COBBLESTONE, count: 2, dur: null };
game.menus.refreshInventory();
const cobbleSlot = game.menus.invSlotEls.find((slot) => slot.index === 10);
cobbleSlot.el.dispatch('pointerdown', makePointerEvent(21, 110, 300));
document._pointElement = cobbleSlot.el;
document.dispatch('pointerup', makePointerEvent(21, 110, 300));
game.menus.craftSlotEls[0].el.dispatch('pointerdown', makePointerEvent(22, 150, 350));
document._pointElement = game.menus.craftSlotEls[0].el;
document.dispatch('pointerup', makePointerEvent(22, 150, 350));
ok(game.menus.craftGrid[0]?.id === BLOCK.COBBLESTONE,
  'Inventar-Items lassen sich weiterhin per Antippen und erneutem Antippen ablegen');
game.menus._returnCraftGrid();
game.menus._dropHeld();

// Einzeltransfer-Modus: Slot auswählen, dann pro Crafting-Tipp genau ein Item einlegen.
game.inventory.slots[11] = { id: BLOCK.LOG, count: 2, dur: null };
game.menus.refreshInventory();
const transferButton = game.menus.singleTransferButton;
transferButton.dispatch('touchend', makeEvent([{ identifier: 30, clientX: 20, clientY: 20 }]));
ok(game.menus.singleTransferMode, 'Einzeltransfer-Button aktiviert den Einlege-Modus');
const transferSource = game.menus.invSlotEls.find((slot) => slot.index === 11);
transferSource.el.dispatch('pointerdown', makePointerEvent(31, 110, 300));
document.dispatch('pointerup', makePointerEvent(31, 110, 300));
ok(game.menus.transferSourceIndex === 11 && game.menus.heldStack === null,
  'Inventar-Slot wird ausgewählt, ohne den ganzen Stapel aufzunehmen');
const transferTarget = game.menus.craftSlotEls[3];
transferTarget.el.dispatch('pointerdown', makePointerEvent(32, 150, 350));
document.dispatch('pointerup', makePointerEvent(32, 150, 350));
ok(game.inventory.slots[11]?.count === 1 && game.menus.craftGrid[3]?.count === 1 && game.menus.heldStack === null,
  'Erster Tipp legt genau ein Item ein und lässt den restlichen Stapel im Inventar');
ok(game.menus.resultSlotEl.stack?.id === BLOCK.PLANKS,
  'Einzeltransfer aktualisiert sofort das Crafting-Ergebnis');
transferTarget.el.dispatch('pointerdown', makePointerEvent(33, 150, 350));
document.dispatch('pointerup', makePointerEvent(33, 150, 350));
ok(game.inventory.slots[11] === null && game.menus.craftGrid[3]?.count === 2,
  'Weiteres Tippen legt jeweils nur ein zusätzliches Item ein');
transferButton.dispatch('touchend', makeEvent([{ identifier: 34, clientX: 20, clientY: 20 }]));
ok(!game.menus.singleTransferMode, 'Einzeltransfer lässt sich wieder ausschalten');
game.menus._returnCraftGrid();

// Mehrteilige Rezepte lassen sich durch getrennte Tipps auf die passenden Felder einsetzen.
game.inventory.slots[12] = { id: BLOCK.PLANKS, count: 2, dur: null };
game.menus.refreshInventory();
transferButton.dispatch('touchend', makeEvent([{ identifier: 35, clientX: 20, clientY: 20 }]));
const plankTransferSource = game.menus.invSlotEls.find((slot) => slot.index === 12);
plankTransferSource.el.dispatch('pointerdown', makePointerEvent(36, 110, 300));
document.dispatch('pointerup', makePointerEvent(36, 110, 300));
game.menus.craftSlotEls[0].el.dispatch('pointerdown', makePointerEvent(37, 150, 350));
document.dispatch('pointerup', makePointerEvent(37, 150, 350));
game.menus.craftSlotEls[2].el.dispatch('pointerdown', makePointerEvent(38, 150, 350));
document.dispatch('pointerup', makePointerEvent(38, 150, 350));
ok(game.inventory.slots[12] === null && game.menus.craftGrid[0]?.id === BLOCK.PLANKS && game.menus.craftGrid[2]?.id === BLOCK.PLANKS,
  'Zwei einzelne Zutaten landen auf zwei Crafting-Feldern');
ok(game.menus.resultSlotEl.stack?.id === BLOCK.STICK,
  'Einzeltransfer erlaubt auch mehrteilige Rezepte wie Stöcke');
transferButton.dispatch('touchend', makeEvent([{ identifier: 39, clientX: 20, clientY: 20 }]));
game.menus._returnCraftGrid();

document._pointElement = null;
invBtn.dispatch('touchstart', makeEvent([{ identifier: 8, clientX: 10, clientY: 10 }]));
ok(game.state === 'playing', 'Inventar-Button schließt Inventar');
game.openWorkbenchInventory();
ok(game.state === 'inventory' && game.menus.craftingMode === 'workbench'
  && game.menus.craftGrid.length === 9 && game.menus.craftSlotEls[4].el.style.display !== 'none',
'Werkbank-Inventar bietet weiterhin ein sichtbares 3×3-Craftingfeld');
game.closeInventory();

// Ofen und Truhe haben eigene, auch per Touch bedienbare Container-Slots.
game.inventory.slots[13] = { id: BLOCK.BEEF, count: 2, dur: null };
game.inventory.slots[14] = { id: BLOCK.COAL, count: 1, dur: null };
game.openFurnace({ x: 1, y: 2, z: 3 });
ok(game.state === 'inventory' && game.menus.inventoryTitle.textContent === 'Schmelzofen',
  'Ofenblock öffnet eine eigene Schmelzoberfläche');
const beefSlot = game.menus.invSlotEls.find((slot) => slot.index === 13);
beefSlot.el.dispatch('pointerdown', makePointerEvent(40, 110, 300));
document._pointElement = game.menus.furnaceSlotEls[0].canvas;
document.dispatch('pointermove', makePointerEvent(40, 170, 360));
document.dispatch('pointerup', makePointerEvent(40, 170, 360));
game.menus._slotClick('inv', 14);
game.menus._slotClick('container', 1);
ok(game.world.furnaces.get('1,2,3').slots[0]?.id === BLOCK.BEEF
  && game.world.furnaces.get('1,2,3').slots[1]?.id === BLOCK.COAL,
'Rohstoff und Brennstoff lassen sich in den Ofen legen');
game._tickFurnaces(5);
ok(game.world.furnaces.get('1,2,3').slots[2]?.id === BLOCK.COOKED_BEEF
  && game.world.furnaces.get('1,2,3').slots[0]?.count === 1,
'Ofen schmilzt rohes Fleisch zu gegartem Fleisch');
game.menus._slotClick('container', 2);
game.menus._slotClick('inv', 15);
game.closeInventory();

game.openChest({ x: 4, y: 2, z: 3 });
ok(game.state === 'inventory' && game.menus.inventoryTitle.textContent === 'Truhe',
  'Truhe öffnet eine eigene Speicheroberfläche');
game.menus._slotClick('inv', 15);
game.menus._slotClick('container', 0);
ok(game.world.chests.get('4,2,3').slots[0]?.id === BLOCK.COOKED_BEEF,
  'Items können in der Truhe gelagert werden');
game.closeInventory();
game.openChest({ x: 4, y: 2, z: 3 });
ok(game.world.chests.get('4,2,3').slots[0]?.id === BLOCK.COOKED_BEEF,
  'Truheninhalt bleibt beim erneuten Öffnen erhalten');
game.closeInventory();

const craftBtn = elById('btn-craft');
craftBtn.dispatch('touchstart', makeEvent([{ identifier: 25, clientX: 10, clientY: 10 }]));
ok(game.state === 'inventory', 'Crafting-Schnellknopf öffnet das Inventar');
invBtn.dispatch('touchstart', makeEvent([{ identifier: 26, clientX: 10, clientY: 10 }]));
ok(game.state === 'playing', 'Inventar bleibt über den Schnellknopf schließbar');

// Menü-Button → Pause
const menuBtn = elById('btn-menu');
menuBtn.dispatch('touchstart', makeEvent([{ identifier: 9, clientX: 10, clientY: 10 }]));
ok(game.state === 'paused', 'Menü-Button öffnet Pause');
menuBtn.dispatch('touchstart', makeEvent([{ identifier: 10, clientX: 10, clientY: 10 }]));
ok(game.state === 'playing', 'Menü-Button kehrt zurück');

// Vollbildmodus ist auch im Hauptmenü erreichbar; der doppelte HUD-Button wird dort ausgeblendet.
game.menus.showScreen('main-menu');
ok(elById('btn-fullscreen').style.display === 'none', 'HUD-Vollbildknopf kollidiert im Hauptmenü nicht mit dem Menü');
const menuFullscreenBtn = elById('btn-fullscreen-menu');
menuFullscreenBtn.dispatch('touchend', makeEvent([{ identifier: 23, clientX: 20, clientY: 20 }]));
await new Promise((r) => setTimeout(r, 0));
ok(document.fullscreenElement === document.documentElement, 'Vollbildknopf im Hauptmenü aktiviert Vollbild');
ok(menuFullscreenBtn.textContent.includes('beenden'), 'Menüknopf zeigt den aktiven Vollbildstatus');
menuFullscreenBtn.dispatch('touchend', makeEvent([{ identifier: 24, clientX: 20, clientY: 20 }]));
await new Promise((r) => setTimeout(r, 0));
ok(document.fullscreenElement === null, 'Vollbildknopf im Hauptmenü beendet Vollbild wieder');
game.menus.hideAll();
ok(elById('btn-fullscreen').style.display === '', 'HUD-Vollbildknopf wird nach dem Hauptmenü wieder eingeblendet');

// Der HUD-Knopf funktioniert während des Spiels ebenfalls.
const fullscreenBtn = elById('btn-fullscreen');
fullscreenBtn.dispatch('touchend', makeEvent([{ identifier: 27, clientX: 20, clientY: 20 }]));
await new Promise((r) => setTimeout(r, 0));
ok(document.fullscreenElement === document.documentElement, 'HUD-Vollbildknopf aktiviert Vollbild');
fullscreenBtn.dispatch('touchend', makeEvent([{ identifier: 28, clientX: 20, clientY: 20 }]));
await new Promise((r) => setTimeout(r, 0));
ok(document.fullscreenElement === null, 'HUD-Vollbildknopf beendet Vollbild wieder');

game.touch.setSneak(true);
const flyingBeforeToggle = game.player.flying;
game._toggleFlight();
ok(game.player.flying !== flyingBeforeToggle && !game.touch.sneak,
  'Flugmoduswechsel löscht den alten mobilen Abwärts-Toggle');

// Pixel-Ratio für Handy begrenzt
ok(game.engine.pixelRatio <= 1.75, `Pixel-Ratio gedrosselt (${game.engine.pixelRatio})`);

rafRunning = false;
console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed > 0 ? 1 : 0);
