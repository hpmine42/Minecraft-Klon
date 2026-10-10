// inventory.js — Inventar, Stapel, Haltbarkeit und Crafting-Rezepte.
import { BLOCKS, BLOCK, TOOL, isPlaceable } from '../world/blocks.js';

export const HOTBAR_SIZE = 9;
export const INV_SIZE = 36; // 0-8 Hotbar, 9-35 Inventar

/** Ein Slot: null | { id, count, dur } */
export function makeStack(id, count = 1, dur = null) {
  const def = BLOCKS[id];
  if (!def) return null;
  const maxDur = def.durability || 0;
  return {
    id,
    count,
    dur: dur != null ? dur : (maxDur > 0 ? maxDur : null),
  };
}

export function stacksEqual(a, b) {
  if (!a || !b) return false;
  return a.id === b.id && (a.dur ?? null) === (b.dur ?? null);
}

export class Inventory {
  constructor(size = INV_SIZE) {
    this.slots = new Array(size).fill(null);
    this.selected = 0; // Hotbar-Index
  }

  /** Aktuell ausgewählter Stapel. */
  held() {
    return this.slots[this.selected];
  }

  /** Item hinzufügen. Gibt übrige Anzahl zurück (0 = alles aufgenommen). */
  add(id, count = 1, dur = null) {
    const def = BLOCKS[id];
    if (!def) return count;
    const maxStack = def.maxStack || 64;
    // Zuerst in vorhandene Stapel (nur ohne Haltbarkeit/Tools)
    if (maxStack > 1 && dur == null && !(def.durability > 0)) {
      for (let i = 0; i < this.slots.length && count > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < maxStack && s.dur == null) {
          const space = maxStack - s.count;
          const move = Math.min(space, count);
          s.count += move;
          count -= move;
        }
      }
    }
    // Dann in leere Slots
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      if (this.slots[i] == null) {
        const move = Math.min(maxStack, count);
        this.slots[i] = makeStack(id, move, dur);
        count -= move;
      }
    }
    return count;
  }

  /** Anzahl eines Items im Inventar. */
  count(id) {
    let n = 0;
    for (const s of this.slots) {
      if (s && s.id === id) n += s.count;
    }
    return n;
  }

  /** Konsumiert Items. Gibt true, wenn genug vorhanden waren. */
  consume(id, count = 1) {
    if (this.count(id) < count) return false;
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, count);
        s.count -= take;
        count -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return true;
  }

  /** Slot-Inhalt setzen (für Drag&Drop). */
  setSlot(i, stack) {
    if (i >= 0 && i < this.slots.length) this.slots[i] = stack;
  }

  getSlot(i) {
    return (i >= 0 && i < this.slots.length) ? this.slots[i] : null;
  }

  /** Zwei Slots tauschen/vereinen. */
  swapSlots(a, b) {
    const sa = this.slots[a];
    const sb = this.slots[b];
    if (sa && sb && stacksEqual(sa, sb)) {
      const def = BLOCKS[sa.id];
      const maxStack = (def && def.maxStack) || 64;
      const space = maxStack - sb.count;
      const move = Math.min(space, sa.count);
      sb.count += move;
      sa.count -= move;
      if (sa.count <= 0) this.slots[a] = null;
    } else {
      this.slots[a] = sb;
      this.slots[b] = sa;
    }
  }

  /** Haltbarkeit des gehaltenen Werkzeugs reduzieren. */
  damageHeld(amount = 1) {
    const s = this.held();
    if (!s) return null;
    const def = BLOCKS[s.id];
    if (!def || !def.durability) return s;
    if (s.dur == null) s.dur = def.durability;
    s.dur -= amount;
    if (s.dur <= 0) {
      this.slots[this.selected] = null;
      return null;
    }
    return s;
  }

  /** Schadensbonus des gehaltenen Werkzeugs. */
  heldDamage() {
    const s = this.held();
    if (!s) return 1;
    const def = BLOCKS[s.id];
    return def && def.damage > 0 ? def.damage : 1;
  }

  /** Serialisierung. */
  toJSON() {
    return {
      selected: this.selected,
      slots: this.slots.map((s) => (s ? { id: s.id, count: s.count, dur: s.dur } : null)),
    };
  }

  fromJSON(data) {
    if (!data) return;
    this.selected = data.selected || 0;
    this.slots = new Array(this.slots.length).fill(null);
    if (Array.isArray(data.slots)) {
      for (let i = 0; i < Math.min(this.slots.length, data.slots.length); i++) {
        const s = data.slots[i];
        if (s) this.slots[i] = makeStack(s.id, s.count, s.dur);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Crafting-Rezepte
// ---------------------------------------------------------------------------
/**
 * Rezept: shaped (Pattern mit Zeichen) oder shapeless (Zutatenliste).
 * pattern: Array aus Strings, ' ' = leer, Buchstabe = Item aus key.
 * result: { id, count }
 */
function shaped(pattern, key, result, name) {
  return { type: 'shaped', pattern, key, result, name };
}
function shapeless(ingredients, result, name) {
  return { type: 'shapeless', ingredients, result, name };
}

const P = BLOCK.PLANKS;
const S = BLOCK.STICK;

export const RECIPES = [
  shapeless([BLOCK.LOG], { id: BLOCK.PLANKS, count: 4 }, 'Holzbretter (Eiche)'),
  shapeless([BLOCK.BIRCH_LOG], { id: BLOCK.PLANKS, count: 4 }, 'Holzbretter (Birke)'),
  shapeless([BLOCK.SPRUCE_LOG], { id: BLOCK.PLANKS, count: 4 }, 'Holzbretter (Fichte)'),
  shaped(['P', 'P'], { P }, { id: BLOCK.STICK, count: 4 }, 'Stöcke'),
  shaped(['PP', 'PP'], { P }, { id: BLOCK.CRAFTING_TABLE, count: 1 }, 'Werkbank'),
  shaped(['CCC', 'C C', 'CCC'], { C: BLOCK.COBBLESTONE }, { id: BLOCK.FURNACE, count: 1 }, 'Schmelzofen'),
  shaped(['PPP', 'P P', 'PPP'], { P }, { id: BLOCK.CHEST, count: 1 }, 'Truhe'),
  shaped(['C', 'S'], { C: BLOCK.COAL, S }, { id: BLOCK.TORCH, count: 4 }, 'Fackeln'),
  shaped(['C', 'S'], { C: BLOCK.REDSTONE, S }, { id: BLOCK.TORCH, count: 1 }, 'Redstone-Fackel'),
  shaped(['SSS', ' S ', ' S '], { S }, { id: BLOCK.LADDER, count: 3 }, 'Leiter'),
  shaped(['SS', 'SS'], { S: BLOCK.SAND }, { id: BLOCK.SANDSTONE, count: 1 }, 'Sandstein'),
  shaped(['SS', 'SS'], { S: BLOCK.STONE }, { id: BLOCK.STONE_BRICKS, count: 4 }, 'Steinziegel'),
  shaped(['SS', 'SS'], { S: BLOCK.CLAY }, { id: BLOCK.BRICKS, count: 4 }, 'Ziegelsteine'),
  shaped(['W'], { W: BLOCK.WHEAT_ITEM }, { id: BLOCK.BREAD, count: 1 }, 'Brot'),
  shaped(['W', 'W', 'W'], { W: BLOCK.WHEAT_ITEM }, { id: BLOCK.BREAD, count: 1 }, 'Brot'),
  shaped(['WWW'], { W: BLOCK.WHEAT_ITEM }, { id: BLOCK.BREAD, count: 1 }, 'Brot'),
  shapeless([BLOCK.BONE], { id: BLOCK.BONE_MEAL, count: 3 }, 'Knochenmehl'),
  shapeless([BLOCK.SUGAR_CANE], { id: BLOCK.SUGAR_CANE, count: 1 }, 'Zuckerrohr'),

  // Werkzeuge: Spitzhacken
  shaped(['MMM', ' S ', ' S '], { M: BLOCK.PLANKS, S }, { id: BLOCK.WOOD_PICKAXE, count: 1 }, 'Holzspitzhacke'),
  shaped(['MMM', ' S ', ' S '], { M: BLOCK.COBBLESTONE, S }, { id: BLOCK.STONE_PICKAXE, count: 1 }, 'Steinspitzhacke'),
  shaped(['MMM', ' S ', ' S '], { M: BLOCK.IRON_INGOT, S }, { id: BLOCK.IRON_PICKAXE, count: 1 }, 'Eisenspitzhacke'),
  shaped(['MMM', ' S ', ' S '], { M: BLOCK.DIAMOND, S }, { id: BLOCK.DIAMOND_PICKAXE, count: 1 }, 'Diamantspitzhacke'),
  // Äxte
  shaped(['MM', 'MS', ' S'], { M: BLOCK.PLANKS, S }, { id: BLOCK.WOOD_AXE, count: 1 }, 'Holzaxt'),
  shaped(['MM', 'MS', ' S'], { M: BLOCK.COBBLESTONE, S }, { id: BLOCK.STONE_AXE, count: 1 }, 'Steinaxt'),
  shaped(['MM', 'MS', ' S'], { M: BLOCK.IRON_INGOT, S }, { id: BLOCK.IRON_AXE, count: 1 }, 'Eisenaxt'),
  shaped(['MM', 'MS', ' S'], { M: BLOCK.DIAMOND, S }, { id: BLOCK.DIAMOND_AXE, count: 1 }, 'Diamantaxt'),
  // Schaufeln
  shaped(['M', 'S', 'S'], { M: BLOCK.PLANKS, S }, { id: BLOCK.WOOD_SHOVEL, count: 1 }, 'Holzschaufel'),
  shaped(['M', 'S', 'S'], { M: BLOCK.COBBLESTONE, S }, { id: BLOCK.STONE_SHOVEL, count: 1 }, 'Steinschaufel'),
  shaped(['M', 'S', 'S'], { M: BLOCK.IRON_INGOT, S }, { id: BLOCK.IRON_SHOVEL, count: 1 }, 'Eisenschaufel'),
  shaped(['M', 'S', 'S'], { M: BLOCK.DIAMOND, S }, { id: BLOCK.DIAMOND_SHOVEL, count: 1 }, 'Diamantschaufel'),
  // Schwerter
  shaped(['M', 'M', 'S'], { M: BLOCK.PLANKS, S }, { id: BLOCK.WOOD_SWORD, count: 1 }, 'Holzschwert'),
  shaped(['M', 'M', 'S'], { M: BLOCK.COBBLESTONE, S }, { id: BLOCK.STONE_SWORD, count: 1 }, 'Steinschwert'),
  shaped(['M', 'M', 'S'], { M: BLOCK.IRON_INGOT, S }, { id: BLOCK.IRON_SWORD, count: 1 }, 'Eisenschwert'),
  shaped(['M', 'M', 'S'], { M: BLOCK.DIAMOND, S }, { id: BLOCK.DIAMOND_SWORD, count: 1 }, 'Diamantschwert'),
  // Hacke
  shaped(['MM', ' S', ' S'], { M: BLOCK.PLANKS, S }, { id: BLOCK.WOOD_HOE, count: 1 }, 'Holzhacke'),
  shaped(['MM', ' S', ' S'], { M: BLOCK.COBBLESTONE, S }, { id: BLOCK.STONE_HOE, count: 1 }, 'Steinhacke'),
  shaped(['MM', ' S', ' S'], { M: BLOCK.IRON_INGOT, S }, { id: BLOCK.IRON_HOE, count: 1 }, 'Eisenhacke'),
  shaped(['MM', ' S', ' S'], { M: BLOCK.DIAMOND, S }, { id: BLOCK.DIAMOND_HOE, count: 1 }, 'Diamanthacke'),
];

/**
 * Prüft ob das 3x3-Raster (9 Slots, null = leer) zu einem Rezept passt.
 * @returns {{id:number,count:number}|null}
 */
export function matchRecipe(grid) {
  if (!grid || grid.length !== 9) return null;
  const ids = grid.map((s) => (s ? s.id : null));
  if (ids.every((i) => i == null)) return null;

  // Belegtes Rechteck finden
  let minR = 3, maxR = -1, minC = 3, maxC = -1;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (ids[r * 3 + c] != null) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
    }
  }
  const w = maxC - minC + 1;
  const h = maxR - minR + 1;
  const cells = [];
  for (let r = 0; r < h; r++) {
    cells.push([]);
    for (let c = 0; c < w; c++) {
      cells[r].push(ids[(minR + r) * 3 + (minC + c)]);
    }
  }

  const usedIds = ids.filter((i) => i != null);

  for (const recipe of RECIPES) {
    if (recipe.type === 'shapeless') {
      const need = [...recipe.ingredients];
      const have = [...usedIds];
      if (need.length !== have.length) continue;
      let okAll = true;
      for (const n of need) {
        const idx = have.indexOf(n);
        if (idx === -1) { okAll = false; break; }
        have.splice(idx, 1);
      }
      if (okAll && have.length === 0) return { ...recipe.result };
    } else {
      const pat = recipe.pattern.map((row) => row.split(''));
      const ph = pat.length;
      const pw = Math.max(...pat.map((r) => r.length));
      if (ph !== h || pw !== w) continue;

      const tryMatch = (gridCells, mirror) => {
        for (let r = 0; r < ph; r++) {
          for (let c = 0; c < pw; c++) {
            const ch = mirror ? pat[r][pw - 1 - c] || ' ' : pat[r][c] || ' ';
            const cell = gridCells[r][c];
            if (ch === ' ') {
              if (cell != null) return false;
            } else {
              const want = recipe.key[ch];
              if (cell !== want) return false;
            }
          }
        }
        return true;
      };
      if (tryMatch(cells, false) || tryMatch(cells, true)) {
        return { ...recipe.result };
      }
    }
  }
  return null;
}

/** Alle Rezepte, die ein Spieler mit "alles" herstellen könnte (für die Hilfe). */
export function listRecipes() {
  return RECIPES.map((r) => ({
    name: r.name,
    result: r.result,
    ingredients: r.type === 'shapeless'
      ? r.ingredients
      : r.pattern.flatMap((row) => row.split('')).filter((c) => c !== ' ').map((c) => r.key[c]),
  }));
}
