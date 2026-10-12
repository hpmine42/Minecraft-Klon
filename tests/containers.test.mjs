// containers.test.mjs — Persistente Truhen-Slots und defensive Save-Normalisierung.
import { BLOCK } from '../src/world/blocks.js';
import { CHEST_SLOT_COUNT, createChestState, serializeChestState } from '../src/player/containers.js';

let passed = 0;
let failed = 0;
function ok(condition, message) {
  if (condition) passed++;
  else { failed++; console.error(`FEHL: ${message}`); }
}

const chest = createChestState();
ok(chest.slots.length === CHEST_SLOT_COUNT && chest.slots.every((slot) => slot === null), 'Neue Truhe hat 27 leere Slots');

const restored = createChestState({ slots: [
  { id: BLOCK.BREAD, count: 8, dur: null },
  { id: BLOCK.IRON_PICKAXE, count: 4, dur: 90 },
  { id: 99999, count: 2 },
  { id: BLOCK.STONE, count: 0 },
  { id: BLOCK.DIRT, count: 100 },
] });
ok(restored.slots[0]?.id === BLOCK.BREAD && restored.slots[0].count === 8, 'Gültige Stapel werden restauriert');
ok(restored.slots[1]?.id === BLOCK.IRON_PICKAXE && restored.slots[1].dur === 90, 'Werkzeug-Haltbarkeit wird restauriert');
ok(restored.slots[2] === null && restored.slots[3] === null, 'Ungültige und leere Speichereinträge werden verworfen');
ok(restored.slots[4]?.count === 64, 'Stapelmengen werden auf das Item-Limit begrenzt');
ok(restored.slots.length === 27, 'Truhe bleibt auch bei kurzer gespeicherter Slotliste vollständig');

const serialized = serializeChestState(restored);
const loadedAgain = createChestState(serialized);
ok(loadedAgain.slots[0]?.count === 8 && loadedAgain.slots[1]?.dur === 90, 'Truheninhalt übersteht Serialisieren und Laden');
ok(loadedAgain.slots !== restored.slots && loadedAgain.slots[0] !== restored.slots[0], 'Geladene Truhe ist unabhängig vom ursprünglichen Zustand');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
