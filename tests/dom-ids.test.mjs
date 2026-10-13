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
  'inventory-body', 'inventory-title', 'btn-close-inventory', 'loading-text', 'death-stats',
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
  'break-progress', 'target-hint', 'world-status', 'fps', 'btn-fullscreen', 'debug', 'hurt-overlay', 'water-overlay', 'mode-label',
];
for (const id of hudIds) {
  if (!htmlIds.has(id)) {
    console.error(`✘ HUD-Element fehlt: #${id}`);
    failed++;
  }
}

// Der Vollbildknopf muss im Hauptmenü außerhalb des HUD-Overlays erreichbar sein.
const mainMenuStart = html.indexOf('<div id="main-menu"');
const pauseScreenStart = html.indexOf('<!-- Pause -->', mainMenuStart);
const mainMenuMarkup = mainMenuStart >= 0 && pauseScreenStart > mainMenuStart
  ? html.slice(mainMenuStart, pauseScreenStart)
  : '';
if (!mainMenuMarkup.includes('id="btn-fullscreen-menu"')) {
  console.error('✘ Vollbildknopf fehlt im Hauptmenü');
  failed++;
}

// Einstellungen
const settingIds = [
  'setting-render-distance', 'setting-fov', 'setting-sensitivity',
  'setting-volume', 'setting-day-length', 'setting-autosave-interval', 'setting-particles',
  'setting-invert-y', 'setting-reduced-motion', 'setting-debug', 'setting-autosave',
  'btn-reset-world', 'btn-delete-save', 'btn-settings-back',
  'btn-export-save', 'btn-import-save', 'save-import-file', 'save-backup-feedback',
];
for (const id of settingIds) {
  if (!htmlIds.has(id)) {
    console.error(`✘ Einstellungs-Element fehlt: #${id}`);
    failed++;
  }
}

// Slider-Werte müssen direkt neben ihrer Beschriftung stehen, nicht als lose Flex-Elemente darunter.
const settingsValueIds = [
  'setting-render-distance-value', 'setting-fov-value', 'setting-sensitivity-value',
  'setting-volume-value', 'setting-day-length-value', 'setting-autosave-interval-value',
];
for (const id of settingsValueIds) {
  const valuePosition = html.indexOf(`id="${id}"`);
  const labelStart = html.lastIndexOf('<label class="setting-control">', valuePosition);
  const labelEnd = html.indexOf('</label>', valuePosition);
  const controlMarkup = labelStart >= 0 && labelEnd > valuePosition
    ? html.slice(labelStart, labelEnd)
    : '';
  if (!controlMarkup.includes('class="setting-title-row"')) {
    console.error(`✘ Wert #${id} ist nicht mit seiner Einstellungsbeschriftung gruppiert`);
    failed++;
  }
}
const settingsMarkup = html.slice(html.indexOf('<div id="settings-screen"'), html.indexOf('<!-- Inventar -->'));
if ((settingsMarkup.match(/class="settings-group(?: settings-group-wide)?"/g) || []).length !== 3) {
  console.error('✘ Einstellungen sind nicht in drei lesbare Gruppen gegliedert');
  failed++;
}

if (failed === 0) {
  console.log(`✔ Alle ${htmlIds.size} HTML-IDs vorhanden, ${new Set([...usedIds, ...mappedIds]).size} verwendete IDs gedeckt`);
} else {
  console.error(`\n${failed} fehlende IDs`);
  process.exit(1);
}
