// furnace.test.mjs — Schmelzrezepte, Brennstoff, Fortschritt und Zustand.
import { BLOCK } from '../src/world/blocks.js';
import {
  canPlaceFurnaceItem,
  createFurnaceState,
  FURNACE_SLOT,
  getFuelDuration,
  getSmeltingRecipe,
  isFuelItem,
  serializeFurnaceState,
  tickFurnace,
} from '../src/player/furnace.js';

let passed = 0;
let failed = 0;
function ok(condition, message) {
  if (condition) passed++;
  else { failed++; console.error(`FEHL: ${message}`); }
}

const recipes = [
  [BLOCK.COBBLESTONE, BLOCK.STONE],
  [BLOCK.IRON_ORE, BLOCK.IRON_INGOT],
  [BLOCK.GOLD_ORE, BLOCK.GOLD_INGOT],
  [BLOCK.SAND, BLOCK.GLASS],
  [BLOCK.CLAY, BLOCK.BRICKS],
  [BLOCK.LOG, BLOCK.CHARCOAL],
  [BLOCK.BIRCH_LOG, BLOCK.CHARCOAL],
  [BLOCK.SPRUCE_LOG, BLOCK.CHARCOAL],
  [BLOCK.PORKCHOP, BLOCK.COOKED_PORKCHOP],
  [BLOCK.BEEF, BLOCK.COOKED_BEEF],
  [BLOCK.CHICKEN, BLOCK.COOKED_CHICKEN],
];
for (const [input, output] of recipes) {
  ok(getSmeltingRecipe(input)?.id === output, `Rezept ${input} → ${output}`);
}
ok(getSmeltingRecipe(BLOCK.DIAMOND_ORE) === null, 'Nicht unterstützte Erze werden nicht geschmolzen');
ok(getSmeltingRecipe(BLOCK.LOG)?.seconds === 8, 'Holz wird in Holzkohle umgewandelt');

ok(getFuelDuration(BLOCK.COAL) === 80, 'Kohle brennt 80 Sekunden');
ok(getFuelDuration(BLOCK.CHARCOAL) === 80, 'Holzkohle brennt 80 Sekunden');
ok(getFuelDuration(BLOCK.PLANKS) === 15, 'Bretter sind Brennstoff');
ok(getFuelDuration(BLOCK.STICK) === 5, 'Stöcke sind Brennstoff');
ok(getFuelDuration(BLOCK.IRON_INGOT) === 0, 'Metallbarren sind kein Brennstoff');
ok(isFuelItem(BLOCK.CHARCOAL), 'Holzkohle wird als Brennstoff erkannt');
ok(canPlaceFurnaceItem(FURNACE_SLOT.INPUT, BLOCK.IRON_ORE), 'Erz passt in den Rohstoff-Slot');
ok(!canPlaceFurnaceItem(FURNACE_SLOT.INPUT, BLOCK.COAL), 'Kohle passt nicht in den Rohstoff-Slot');
ok(canPlaceFurnaceItem(FURNACE_SLOT.FUEL, BLOCK.COAL), 'Kohle passt in den Brennstoff-Slot');
ok(!canPlaceFurnaceItem(FURNACE_SLOT.OUTPUT, BLOCK.IRON_INGOT), 'Ergebnis-Slot ist nicht befüllbar');

const idle = createFurnaceState({ slots: [{ id: BLOCK.IRON_ORE, count: 1 }, null, null] });
ok(tickFurnace(idle, 2) === false, 'Ohne Brennstoff entsteht kein Produkt');
ok(idle.progress === 0 && idle.slots[0].count === 1, 'Ohne Brennstoff bleibt der Rohstoff unverändert');

const furnace = createFurnaceState({
  slots: [
    { id: BLOCK.IRON_ORE, count: 2, dur: null },
    { id: BLOCK.COAL, count: 1, dur: null },
    null,
  ],
});
ok(tickFurnace(furnace, 4) === true, 'Beim Start wird eine Kohle verbraucht');
ok(furnace.slots[FURNACE_SLOT.FUEL] === null, 'Letzte Kohle wurde aus dem Brennstoff-Slot entfernt');
ok(furnace.progress === 4 && furnace.slots[FURNACE_SLOT.INPUT].count === 2, 'Schmelzfortschritt wird angesammelt');
ok(tickFurnace(furnace, 4) === true, 'Nach acht Sekunden wird ein Barren ausgegeben');
ok(furnace.slots[FURNACE_SLOT.OUTPUT]?.id === BLOCK.IRON_INGOT, 'Eisenbarren liegt im Ergebnis-Slot');
ok(furnace.slots[FURNACE_SLOT.INPUT]?.count === 1, 'Ein Erz wurde verbraucht');
ok(tickFurnace(furnace, 8) === true, 'Zweites Erz kann mit derselben Brennladung verarbeitet werden');
ok(furnace.slots[FURNACE_SLOT.OUTPUT]?.count === 2, 'Barren werden im Ergebnis-Slot gestapelt');
ok(furnace.slots[FURNACE_SLOT.INPUT] === null, 'Alle Erze wurden verbraucht');

const charcoal = createFurnaceState({
  slots: [
    { id: BLOCK.BIRCH_LOG, count: 1 },
    { id: BLOCK.COAL, count: 1 },
    null,
  ],
});
tickFurnace(charcoal, 8);
ok(charcoal.slots[FURNACE_SLOT.OUTPUT]?.id === BLOCK.CHARCOAL, 'Holz ergibt Holzkohle');
ok(getFuelDuration(charcoal.slots[FURNACE_SLOT.OUTPUT].id) === 80, 'Erzeugte Holzkohle kann den Ofen befeuern');

const blocked = createFurnaceState({
  slots: [
    { id: BLOCK.IRON_ORE, count: 1 },
    { id: BLOCK.COAL, count: 1 },
    { id: BLOCK.IRON_INGOT, count: 64 },
  ],
});
ok(tickFurnace(blocked, 3) === false, 'Volle Ausgabe verhindert das Schmelzen');
ok(blocked.slots[FURNACE_SLOT.FUEL].count === 1 && blocked.progress === 0, 'Bei voller Ausgabe wird kein neuer Brennstoff verbraucht');

const burningWithoutInput = createFurnaceState({ burnRemaining: 5, burnTotal: 80 });
tickFurnace(burningWithoutInput, 2);
ok(burningWithoutInput.burnRemaining === 3, 'Bereits entzündeter Brennstoff brennt auch ohne Eingang weiter');
tickFurnace(burningWithoutInput, 4);
ok(burningWithoutInput.burnRemaining === 0 && burningWithoutInput.burnTotal === 0, 'Abgebrannter Brennstoff wird zurückgesetzt');

const saved = serializeFurnaceState(furnace);
const restored = createFurnaceState(saved);
ok(restored.slots[FURNACE_SLOT.OUTPUT]?.count === 2, 'Ergebnis bleibt beim Speichern erhalten');
ok(restored.burnRemaining === furnace.burnRemaining, 'Brennzeit bleibt beim Speichern erhalten');
ok(restored.slots !== furnace.slots && restored.slots[2] !== furnace.slots[2], 'Geladene Ofen-Slots sind unabhängige Objekte');
const sanitized = createFurnaceState({
  slots: [{ id: BLOCK.IRON_ORE, count: 999 }, { id: 9999, count: 3 }],
  progress: -4,
  burnRemaining: 'not-a-number',
});
ok(sanitized.slots[0].count === 64 && sanitized.slots[1] === null, 'Ungültige/zu große gespeicherte Stapel werden bereinigt');
ok(sanitized.progress === 0 && sanitized.burnRemaining === 0, 'Ungültige Fortschrittswerte werden bereinigt');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
