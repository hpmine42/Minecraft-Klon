// inventory-desktop.test.mjs — Minecraft-typische Mausbedienung für Inventar-Slots.
import { BLOCK } from '../src/world/blocks.js';
import { Inventory } from '../src/player/inventory.js';
import { Menus } from '../src/ui/menus.js';

let passed = 0;
let failed = 0;
function ok(condition, message) {
  if (condition) passed++;
  else { failed++; console.error(`FEHL: ${message}`); }
}

function makeMenus() {
  const menus = Object.create(Menus.prototype);
  menus.inventory = new Inventory();
  menus.craftGrid = Array(4).fill(null);
  menus.craftingMode = 'player';
  menus.craftRemainder = null;
  menus.heldStack = null;
  menus.containerSession = null;
  menus.containerNotice = null;
  menus.cb = {};
  menus.singleTransferMode = false;
  menus.transferSourceIndex = -1;
  menus._mouseGesture = null;
  menus.refreshCount = 0;
  menus.refreshInventory = () => { menus.refreshCount++; };
  menus._positionFloatingStack = (point) => { menus.lastCursorPoint = [point.clientX, point.clientY]; };
  menus.slotAt = new Map();
  menus._slotAtPoint = (x) => menus.slotAt.get(x) || null;
  return menus;
}

const menus = makeMenus();
menus.inventory.setSlot(0, { id: BLOCK.DIRT, count: 12, dur: null });
menus._slotClick('inv', 0, 0);
ok(menus.inventory.getSlot(0) === null && menus.heldStack?.count === 12,
  'Linksklick nimmt den gesamten Stapel an den Cursor');
menus._slotClick('inv', 1, 0);
ok(menus.inventory.getSlot(1)?.count === 12 && menus.heldStack === null,
  'Erneuter Linksklick legt den ganzen Stapel ab');

menus.inventory.setSlot(2, { id: BLOCK.DIRT, count: 9, dur: null });
menus._slotClick('inv', 2, 2);
ok(menus.inventory.getSlot(2)?.count === 4 && menus.heldStack?.count === 5,
  'Rechtsklick nimmt die aufgerundete Hälfte eines Stapels');
menus._slotClick('inv', 3, 2);
ok(menus.inventory.getSlot(3)?.count === 1 && menus.heldStack?.count === 4,
  'Rechtsklick legt genau ein Item in einen leeren Slot');

menus.inventory.setSlot(4, { id: BLOCK.DIRT, count: 63, dur: null });
menus.heldStack = { id: BLOCK.DIRT, count: 5, dur: null };
menus._slotClick('inv', 4, 2);
ok(menus.inventory.getSlot(4)?.count === 64 && menus.heldStack?.count === 4,
  'Rechtsklick ergänzt einen passenden Stapel um genau ein Item');
menus._slotClick('inv', 4, 0);
ok(menus.inventory.getSlot(4)?.count === 64 && menus.heldStack?.count === 4,
  'Voller Stapel nimmt keine weiteren Items an');

menus.inventory.setSlot(5, { id: BLOCK.DIRT, count: 62, dur: null });
menus.heldStack = { id: BLOCK.DIRT, count: 6, dur: null };
menus._slotClick('inv', 5, 0);
ok(menus.inventory.getSlot(5)?.count === 64 && menus.heldStack?.count === 4,
  'Linksklick füllt einen passenden Stapel so weit wie möglich');
menus.inventory.setSlot(6, { id: BLOCK.STONE, count: 2, dur: null });
menus.heldStack = { id: BLOCK.SAND, count: 3, dur: null };
menus._slotClick('inv', 6, 0);
ok(menus.inventory.getSlot(6)?.id === BLOCK.SAND && menus.heldStack?.id === BLOCK.STONE,
  'Linksklick tauscht zwei unterschiedliche Stapel');
menus.inventory.setSlot(7, { id: BLOCK.STONE, count: 2, dur: null });
menus.heldStack = { id: BLOCK.SAND, count: 3, dur: null };
menus._slotClick('inv', 7, 2);
ok(menus.inventory.getSlot(7)?.id === BLOCK.STONE && menus.heldStack?.id === BLOCK.SAND,
  'Rechtsklick tauscht keine unterschiedlichen Stapel');

// Tatsächlicher Desktop-Mausablauf: Aufnehmen, Cursor verfolgen, am Ziel loslassen.
menus.heldStack = null;
menus.inventory.setSlot(14, { id: BLOCK.PLANKS, count: 8, dur: null });
menus.slotAt.set(10, { kind: 'inv', index: 14 });
menus.slotAt.set(20, { kind: 'inv', index: 15 });
const mouseEvent = (button, x, y = 0) => ({
  button, clientX: x, clientY: y,
  preventDefault() {}, stopPropagation() {},
});
menus._startDesktopInventoryMouse(mouseEvent(0, 10), 'inv', 14);
ok(menus.inventory.getSlot(14) === null && menus.heldStack?.count === 8,
  'Maus-Aufnehmen hebt den Stapel sofort an');
menus._moveDesktopInventoryMouse(mouseEvent(0, 20));
ok(menus.lastCursorPoint?.[0] === 20, 'Schwebender Stapel folgt der Mausbewegung');
menus._endDesktopInventoryMouse(mouseEvent(0, 20));
ok(menus.inventory.getSlot(15)?.count === 8 && menus.heldStack === null,
  'Maus-Drag legt den ganzen Stapel am Loslass-Slot ab');

// Rechtsziehen verteilt eins pro Slot; Linksziehen teilt den Stapel gleichmäßig.
menus.heldStack = { id: BLOCK.DIRT, count: 7, dur: null };
menus.slotAt.set(30, { kind: 'inv', index: 16 });
menus.slotAt.set(40, { kind: 'inv', index: 17 });
menus.slotAt.set(50, { kind: 'inv', index: 18 });
menus._startDesktopInventoryMouse(mouseEvent(2, 30), 'inv', 16);
menus._moveDesktopInventoryMouse(mouseEvent(2, 40));
menus._moveDesktopInventoryMouse(mouseEvent(2, 50));
menus._endDesktopInventoryMouse(mouseEvent(2, 50));
ok([16, 17, 18].every((index) => menus.inventory.getSlot(index)?.count === 1)
  && menus.heldStack?.count === 4,
'Rechtsziehen legt genau ein Item pro berührtem Slot ab');

menus.heldStack = { id: BLOCK.SAND, count: 10, dur: null };
menus.slotAt.set(60, { kind: 'inv', index: 19 });
menus.slotAt.set(70, { kind: 'inv', index: 20 });
menus.slotAt.set(80, { kind: 'inv', index: 21 });
menus._startDesktopInventoryMouse(mouseEvent(0, 60), 'inv', 19);
menus._moveDesktopInventoryMouse(mouseEvent(0, 70));
menus._moveDesktopInventoryMouse(mouseEvent(0, 80));
menus._endDesktopInventoryMouse(mouseEvent(0, 80));
ok(menus.inventory.getSlot(19)?.count === 4
  && menus.inventory.getSlot(20)?.count === 3
  && menus.inventory.getSlot(21)?.count === 3
  && menus.heldStack === null,
'Linksziehen verteilt den Stapel möglichst gleichmäßig auf alle Slots');

const furnaceState = { slots: [null, null, { id: BLOCK.IRON_INGOT, count: 9, dur: null }] };
menus.containerSession = { type: 'furnace', state: furnaceState, slots: furnaceState.slots };
menus.heldStack = null;
menus._slotClick('container', 2, 2);
ok(furnaceState.slots[2]?.count === 4 && menus.heldStack?.count === 5,
'Rechtsklick nimmt die aufgerundete Hälfte aus dem Ofen-Ergebnis');
menus.heldStack = { id: BLOCK.IRON_ORE, count: 4, dur: null };
menus._slotClick('container', 0, 2);
ok(furnaceState.slots[0]?.count === 1 && menus.heldStack?.count === 3,
'Rechtsklick legt genau ein passendes Rohstoff-Item in den Ofen');

// Shift-Klick verschiebt komplette Stapel zwischen Hauptinventar und Hotbar.
const shiftMenus = makeMenus();
shiftMenus.inventory.setSlot(12, { id: BLOCK.DIRT, count: 17, dur: null });
shiftMenus._shiftClick('inv', 12);
ok(shiftMenus.inventory.getSlot(12) === null && shiftMenus.inventory.getSlot(0)?.count === 17,
  'Shift-Klick verschiebt einen Stapel aus dem Hauptinventar in die Hotbar');
shiftMenus._shiftClick('inv', 0);
ok(shiftMenus.inventory.getSlot(0) === null && shiftMenus.inventory.getSlot(9)?.count === 17,
  'Shift-Klick verschiebt einen Hotbar-Stapel zurück ins Hauptinventar');

// Shift-Klick auf das Ergebnis stellt wiederholt Rezepte her, solange Platz vorhanden ist.
shiftMenus.craftGrid = [
  { id: BLOCK.PLANKS, count: 2, dur: null }, null,
  { id: BLOCK.PLANKS, count: 2, dur: null }, null,
];
shiftMenus._shiftClick('result', 0);
ok(shiftMenus.inventory.count(BLOCK.STICK) === 8
  && shiftMenus.craftGrid.every((stack) => !stack),
'Crafting-Ergebnis per Shift-Klick stellt alle möglichen Rezepte her und lagert sie ein');

// Rechtsklick auf einen Crafting-Ausgang nimmt eines und hält den Rest sicher bereit.
const rightCraft = makeMenus();
rightCraft.craftGrid = [{ id: BLOCK.LOG, count: 1, dur: null }, null, null, null];
rightCraft._takeCraftResult(2);
ok(rightCraft.heldStack?.id === BLOCK.PLANKS && rightCraft.heldStack.count === 1
  && rightCraft.craftRemainder?.count === 3 && rightCraft.craftGrid.every((stack) => !stack),
'Rechtsklick auf ein 4er-Rezept nimmt eins und bewahrt die übrigen drei Ergebnisse');
rightCraft._takeCraftResult(0);
ok(rightCraft.heldStack?.count === 4 && rightCraft.craftRemainder === null,
'Übrige Crafting-Ergebnisse lassen sich ohne erneuten Zutatenverbrauch einsammeln');

// Schließen gibt Cursor- und Craftingstapel zurück; bei voller Tasche wird genau
// der nicht einlagerbare Rest als einzelner Item-Drop weitergegeben.
const closeMenus = makeMenus();
closeMenus.craftGrid = [{ id: BLOCK.SAND, count: 5, dur: null }, null, null, null];
closeMenus.heldStack = { id: BLOCK.DIRT, count: 3, dur: null };
closeMenus.closeActiveInventory();
ok(closeMenus.inventory.count(BLOCK.SAND) === 5 && closeMenus.inventory.count(BLOCK.DIRT) === 3
  && closeMenus.craftGrid.every((stack) => !stack) && closeMenus.heldStack === null,
'Inventar schließen bringt Crafting- und Cursorstapel zurück ins Inventar');
const fullMenus = makeMenus();
const overflowDrops = [];
fullMenus.cb.onDropStack = (id, count) => overflowDrops.push({ id, count });
for (let index = 0; index < fullMenus.inventory.slots.length; index++) {
  fullMenus.inventory.setSlot(index, { id: BLOCK.DIRT, count: 64, dur: null });
}
fullMenus.heldStack = { id: BLOCK.SAND, count: 2, dur: null };
fullMenus.closeActiveInventory();
ok(overflowDrops.length === 1 && overflowDrops[0].id === BLOCK.SAND && overflowDrops[0].count === 2,
'Volles Inventar gibt den übrigen Cursorstapel genau einmal als Drop zurück');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
