// hud.test.mjs — Weltstatus, Zielhinweise, Screenshotmodus und Uhrformat.
import { HUD, formatWorldClock } from '../src/ui/hud.js';
import { BLOCK } from '../src/world/blocks.js';
import { Inventory } from '../src/player/inventory.js';

function makeElement() {
  return {
    style: {},
    dataset: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    getContext() { return { clearRect() {}, drawImage() {} }; },
  };
}

globalThis.document = { createElement: () => makeElement() };

let passed = 0;
let failed = 0;
function ok(condition, message) {
  if (condition) passed++;
  else { failed++; console.error(`FEHL: ${message}`); }
}

ok(formatWorldClock(0) === '06:00'
  && formatWorldClock(0.25) === '12:00'
  && formatWorldClock(0.5) === '18:00'
  && formatWorldClock(0.75) === '00:00',
'Weltuhr stimmt mit Sonnenaufgang, Mittag, Sonnenuntergang und Mitternacht überein');
ok(formatWorldClock(Number.NaN) === '--:--', 'Ungültige Zeitwerte erzeugen keine fehlerhafte Anzeige');

const root = makeElement();
const targetHint = makeElement();
const worldStatus = makeElement();
const inventory = new Inventory();
const hud = new HUD({
  root,
  targetHint,
  worldStatus,
  hotbar: makeElement(),
  hearts: makeElement(),
  hunger: makeElement(),
  air: makeElement(),
  itemName: makeElement(),
  breakProgress: makeElement(),
  fps: makeElement(),
  hurtOverlay: makeElement(),
  waterOverlay: makeElement(),
  modeLabel: makeElement(),
}, {}, inventory);

hud.setGameplayActive(true);
hud.setTargetHint({ id: BLOCK.CHEST }, { gamemode: 'survival', hunger: 10, maxHunger: 20 }, false);
ok(targetHint.textContent === 'Truhe · Rechtsklick öffnen' && targetHint.style.display === 'block',
  'Zielhinweis zeigt die direkte Bedienung für Truhen an');
hud.setTargetHint(null);
ok(targetHint.textContent === '' && targetHint.style.display === 'none',
  'Zielhinweis verschwindet, sobald kein Block anvisiert wird');
hud.setTargetHint({ id: BLOCK.STONE }, { gamemode: 'survival', hunger: 10, maxHunger: 20 }, true);
ok(targetHint.textContent === 'Stein · ⛏ abbauen', 'Mobile Zielhinweise verwenden die Touch-Aktionssymbole');

hud.setWorldStatus({ biome: 'Wald', timeOfDay: 0.25, weather: 'clear', y: 37.8 });
ok(worldStatus.textContent === 'Wald · 12:00 · ☀ Klar · Y 37'
  && worldStatus.style.display === 'block',
'Weltstatus zeigt Biom, Weltzeit, Wetter und Höhe kompakt an');
hud.setWorldStatus();
ok(worldStatus.textContent === '' && worldStatus.style.display === 'none',
'Weltstatus lässt sich beim Verlassen der Welt sicher ausblenden');
ok(hud.setHidden(true) === true && hud.hidden && root.style.display === 'none'
  && hud.setHidden(false) === false && root.style.display === '',
'Screenshotmodus blendet das HUD aus und stellt es vollständig wieder her');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
