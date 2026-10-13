// storage.test.mjs — Fehlerhafte Browserdaten sicher zurückweisen, ohne gespeicherte Bytes anzutasten.
import { defaultSettings, loadGame, loadSettings, saveGame, saveSettings } from '../src/save/storage.js';

const SAVE_KEY = 'minecraft-klon-save-v1';
const SETTINGS_KEY = 'minecraft-klon-settings-v1';
const store = new Map();
globalThis.localStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
};

let passed = 0;
let failed = 0;
function ok(condition, message) {
  if (condition) passed++;
  else { failed++; console.error(`FEHL: ${message}`); }
}

const validSave = {
  version: 1,
  seed: 0,
  worldType: 'normal',
  player: { position: { x: 0.5, y: 34, z: 0.5 }, yaw: 0, pitch: 0 },
  inventory: { selected: 0, slots: [] },
};
store.set(SAVE_KEY, JSON.stringify(validSave));
ok(loadGame()?.seed === 0, 'Gültige Spielstände einschließlich Seed 0 werden geladen');

const malformedSave = JSON.stringify({ version: 1, seed: 42 });
store.set(SAVE_KEY, malformedSave);
ok(loadGame() === null && store.get(SAVE_KEY) === malformedSave,
  'Unvollständiger Spielstand wird zurückgewiesen, aber nicht gelöscht oder überschrieben');
const invalidPositionSave = JSON.stringify({
  ...validSave,
  player: { position: { x: 1, y: null, z: 2 } },
});
store.set(SAVE_KEY, invalidPositionSave);
ok(loadGame() === null && store.get(SAVE_KEY) === invalidPositionSave,
  'Nicht-endliche Spielerpositionen werden zurückgewiesen und bleiben zur Wiederherstellung erhalten');

store.set(SETTINGS_KEY, JSON.stringify({
  renderDistance: 99,
  fov: 55,
  sensitivity: 'schnell',
  volume: -4,
  dayLength: 450,
  autosaveInterval: 9999,
  particles: 'ultra',
  showDebug: true,
  invertY: 'false',
  autosave: false,
}));
const settings = loadSettings();
ok(settings.renderDistance === 10 && settings.fov === 60 && settings.volume === 0
  && settings.dayLength === 450 && settings.autosaveInterval === 3600
  && settings.showDebug === true && settings.autosave === false
  && !('sensitivity' in settings) && !('particles' in settings) && !('invertY' in settings),
  'Geladene Einstellungen werden auf bekannte Typen und sichere Wertebereiche normalisiert');
ok({ ...defaultSettings(false), ...settings }.sensitivity === defaultSettings(false).sensitivity,
  'Ungültige Einstellungen fallen auf geräteabhängige Standardwerte zurück');

const originalSetItem = localStorage.setItem;
localStorage.setItem = (key, value) => {
  if (key === SAVE_KEY) throw new Error('quota');
  originalSetItem.call(localStorage, key, value);
};
store.set(SAVE_KEY, JSON.stringify(validSave));
const preservedSave = store.get(SAVE_KEY);
const originalWarn = console.warn;
console.warn = () => {};
const saveResult = saveGame(
  { seed: 1, worldType: 'normal', modified: new Map() },
  { toJSON: () => validSave.player },
  { toJSON: () => validSave.inventory },
);
console.warn = originalWarn;
ok(saveResult === false && store.get(SAVE_KEY) === preservedSave,
  'Fehlgeschlagener Storage-Write lässt den bisherigen Spielstand intakt');

saveSettings({ fov: 90 });
ok(loadSettings().fov === 90, 'Gültige Einstellungen bleiben dauerhaft speicherbar');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
