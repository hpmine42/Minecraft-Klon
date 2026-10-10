// dom-ids.test.mjs — Prüft, dass alle in main.js/menus.js verwendeten DOM-IDs in index.html existieren.
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const mainSrc = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

// IDs im HTML
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

// $('id') Aufrufe in main.js
const usedIds = [...mainSrc.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);

// Menü-Element-Mapping: 'key': $('id') ODER 'key': $('id')
const mappedIds = [...mainSrc.matchAll(/'([a-z0-9-]+)':\s*\$\('([^']+)'\)/g)].map((m) => m[2]);

let failed = 0;
for (const id of [...new Set([...usedIds, ...mappedIds])]) {
  if (!htmlIds.has(id)) {
    console.error(`✘ Fehlende ID im HTML: #${id}`);
    failed++;
  }
}

// Umgekehrt: Alle Screen-IDs die Menus erwartet
const expectedScreens = [
  'main-menu', 'pause-menu', 'settings-screen', 'inventory-screen',
  'death-screen', 'help-screen', 'loading-screen', 'selftest-screen',
  'inventory-body', 'btn-close-inventory', 'loading-text', 'death-stats',
  'help-content', 'selftest-results', 'btn-selftest-back',
];
for (const id of expectedScreens) {
  if (!htmlIds.has(id)) {
    console.error(`✘ Screen-ID fehlt: #${id}`);
    failed++;
  }
}

// Touch-Buttons
const touchIds = [
  'mobile-controls', 'joystick-zone', 'joystick-knob', 'look-zone',
  'btn-jump', 'btn-sneak', 'btn-fly', 'btn-attack', 'btn-place',
  'btn-inventory', 'btn-craft', 'btn-menu', 'btn-debug',
];
for (const id of touchIds) {
  if (!htmlIds.has(id)) {
    console.error(`✘ Touch-Button fehlt: #${id}`);
    failed++;
  }
}

// HUD-Elemente
const hudIds = [
  'game', 'hud', 'hotbar', 'hearts', 'hunger', 'air', 'item-name',
  'break-progress', 'fps', 'btn-fullscreen', 'debug', 'hurt-overlay', 'water-overlay', 'mode-label',
];
for (const id of hudIds) {
  if (!htmlIds.has(id)) {
    console.error(`✘ HUD-Element fehlt: #${id}`);
    failed++;
  }
}

// Einstellungen
const settingIds = [
  'setting-render-distance', 'setting-fov', 'setting-sensitivity',
  'setting-volume', 'setting-day-length', 'setting-particles',
  'setting-invert-y', 'setting-debug', 'setting-autosave',
  'btn-reset-world', 'btn-delete-save', 'btn-settings-back',
];
for (const id of settingIds) {
  if (!htmlIds.has(id)) {
    console.error(`✘ Einstellungs-Element fehlt: #${id}`);
    failed++;
  }
}

if (failed === 0) {
  console.log(`✔ Alle ${htmlIds.size} HTML-IDs vorhanden, ${new Set([...usedIds, ...mappedIds]).size} verwendete IDs gedeckt`);
} else {
  console.error(`\n${failed} fehlende IDs`);
  process.exit(1);
}
