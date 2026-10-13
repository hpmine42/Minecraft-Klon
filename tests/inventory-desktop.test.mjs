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

const fullStackMenus = makeMenus();
fullStackMenus.inventory.setSlot(0, { id: BLOCK.DIRT, count: 64, dur: null });
fullStackMenus._slotClick('inv', 0, 0);
ok(fullStackMenus.inventory.getSlot(0) === null && fullStackMenus.heldStack?.count === 64,
  'Linksklick nimmt einen vollständigen 64er-Stapel auf');
fullStackMenus._slotClick('inv', 1, 0);
ok(fullStackMenus.inventory.getSlot(1)?.count === 64 && fullStackMenus.heldStack === null,
  'Ein vollständiger 64er-Stapel wird unverändert abgelegt');
fullStackMenus.inventory.setSlot(2, { id: BLOCK.DIRT, count: 63, dur: null });
fullStackMenus._slotClick('inv', 2, 2);
ok(fullStackMenus.inventory.getSlot(2)?.count === 31 && fullStackMenus.heldStack?.count === 32,
  'Rechtsklick halbiert 63 Items mit Aufrunden auf 32 Cursor-Items');

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

const rapidMenus = makeMenus();
rapidMenus.inventory.setSlot(0, { id: BLOCK.DIRT, count: 64, dur: null });
let rapidCountsAlwaysValid = true;
for (let click = 0; click < 250; click++) {
  rapidMenus._slotClick('inv', click % 2, click % 3 === 0 ? 2 : 0);
  const stacks = [rapidMenus.inventory.getSlot(0), rapidMenus.inventory.getSlot(1), rapidMenus.heldStack].filter(Boolean);
  rapidCountsAlwaysValid &&= stacks.every((stack) => Number.isInteger(stack.count) && stack.count > 0 && stack.count <= 64);
}
const rapidTotal = rapidMenus.inventory.count(BLOCK.DIRT) + (rapidMenus.heldStack?.count || 0);
ok(rapidCountsAlwaysValid && rapidTotal === 64,
'Schnelle Links-/Rechtsklicks erzeugen weder Duplikate noch negative oder übergroße Stapel');

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

const capacityMenus = makeMenus();
capacityMenus.inventory.setSlot(0, { id: BLOCK.STONE, count: 1, dur: null });
capacityMenus.inventory.setSlot(1, { id: BLOCK.DIRT, count: 60, dur: null });
capacityMenus.inventory.setSlot(2, { id: BLOCK.DIRT, count: 64, dur: null });
capacityMenus.heldStack = { id: BLOCK.DIRT, count: 64, dur: null };
capacityMenus.slotAt.set(10, { kind: 'inv', index: 0 }); // Ungültiger Startslot: wird nicht gezählt.
capacityMenus.slotAt.set(20, { kind: 'inv', index: 1 });
capacityMenus.slotAt.set(30, { kind: 'inv', index: 2 });
capacityMenus._startDesktopInventoryMouse(mouseEvent(0, 10), 'inv', 0);
capacityMenus._moveDesktopInventoryMouse(mouseEvent(0, 20));
capacityMenus._endDesktopInventoryMouse(mouseEvent(0, 20));
ok(capacityMenus.inventory.getSlot(1)?.count === 64 && capacityMenus.heldStack?.count === 60
  && capacityMenus.inventory.getSlot(0)?.id === BLOCK.STONE,
'Ziehen auf einen Stapel mit 60 Items ergänzt nur die vier freien Plätze');
capacityMenus._startDesktopInventoryMouse(mouseEvent(0, 10), 'inv', 0);
capacityMenus._moveDesktopInventoryMouse(mouseEvent(0, 30));
capacityMenus._endDesktopInventoryMouse(mouseEvent(0, 30));
ok(capacityMenus.inventory.getSlot(2)?.count === 64 && capacityMenus.heldStack?.count === 60,
'Ziehen auf einen vollen Stapel lässt den Cursorstapel unverändert');
capacityMenus._startDesktopInventoryMouse(mouseEvent(0, 20), 'inv', 1);
capacityMenus._endDesktopInventoryMouse(mouseEvent(0, 200));
ok(capacityMenus.heldStack?.count === 60,
'Loslassen außerhalb des Inventars verliert keinen Cursorstapel');

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

const priorityMenus = makeMenus();
priorityMenus.inventory.setSlot(12, { id: BLOCK.DIRT, count: 17, dur: null });
priorityMenus.inventory.setSlot(1, { id: BLOCK.DIRT, count: 60, dur: null });
priorityMenus._shiftClick('inv', 12);
ok(priorityMenus.inventory.getSlot(1)?.count === 64
  && priorityMenus.inventory.getSlot(0)?.count === 13
  && priorityMenus.inventory.getSlot(12) === null,
'Shift-Klick füllt zuerst kompatible Stapel und belegt danach leere Slots');

const equipmentMenus = makeMenus();
equipmentMenus.inventory.setSlot(10, { id: BLOCK.TORCH, count: 4, dur: null });
equipmentMenus._shiftClick('inv', 10);
ok(equipmentMenus.inventory.getEquipment('offhand')?.id === BLOCK.TORCH
  && equipmentMenus.inventory.getEquipment('offhand')?.count === 4
  && equipmentMenus.inventory.getSlot(10) === null,
'Shift-Klick legt ein laut Itemdefinition erlaubtes Item in die Nebenhand');
equipmentMenus.heldStack = { id: BLOCK.BREAD, count: 1, dur: null };
equipmentMenus._slotClick('equipment', 4, 0);
ok(equipmentMenus.inventory.getEquipment('offhand')?.id === BLOCK.TORCH
  && equipmentMenus.inventory.getEquipment('offhand')?.count === 4
  && equipmentMenus.heldStack?.id === BLOCK.BREAD,
'Undefinierte Items lassen sich nicht in die belegte Nebenhand ablegen');

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
const cursorDrops = [];
closeMenus.cb.onDropStack = (id, count, stack) => {
  cursorDrops.push({ id, count, dur: stack?.dur ?? null });
  return true;
};
closeMenus.craftGrid = [{ id: BLOCK.SAND, count: 5, dur: null }, null, null, null];
closeMenus.heldStack = { id: BLOCK.DIRT, count: 3, dur: null };
closeMenus.closeActiveInventory();
ok(closeMenus.inventory.count(BLOCK.SAND) === 5 && closeMenus.inventory.count(BLOCK.DIRT) === 0
  && cursorDrops.length === 1 && cursorDrops[0].id === BLOCK.DIRT && cursorDrops[0].count === 3
  && closeMenus.craftGrid.every((stack) => !stack) && closeMenus.heldStack === null,
'Beim Schließen gehen Craftingzutaten zurück, der Cursorstapel wird in die Welt geworfen');
const fullMenus = makeMenus();
const overflowDrops = [];
fullMenus.cb.onDropStack = (id, count) => { overflowDrops.push({ id, count }); return true; };
for (let index = 0; index < fullMenus.inventory.slots.length; index++) {
  fullMenus.inventory.setSlot(index, { id: BLOCK.DIRT, count: 64, dur: null });
}
fullMenus.heldStack = { id: BLOCK.SAND, count: 2, dur: null };
fullMenus.closeActiveInventory();
ok(overflowDrops.length === 1 && overflowDrops[0].id === BLOCK.SAND && overflowDrops[0].count === 2,
'Volles Inventar gibt den Cursorstapel genau einmal als Welt-Drop zurück');
const noDropSystem = makeMenus();
for (let index = 0; index < noDropSystem.inventory.slots.length; index++) {
  noDropSystem.inventory.setSlot(index, { id: BLOCK.DIRT, count: 64, dur: null });
}
noDropSystem.heldStack = { id: BLOCK.SAND, count: 2, dur: null };
noDropSystem.closeActiveInventory();
ok(noDropSystem.heldStack?.id === BLOCK.SAND && noDropSystem.heldStack?.count === 2,
'Ohne Welt-Drop-System bleibt ein bei vollem Inventar nicht einlagerbarer Stapel erhalten');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
