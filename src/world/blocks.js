// blocks.js — Block-Registry: IDs, Eigenschaften, Texture-Kacheln, Drops, Werkzeug-Klassen.

export const BLOCK = {
  AIR: 0,
  STONE: 1,
  GRASS: 2,
  DIRT: 3,
  COBBLESTONE: 4,
  PLANKS: 5,
  SAPLING: 6,
  BEDROCK: 7,
  WATER: 8,
  LAVA: 9,
  SAND: 10,
  GRAVEL: 11,
  GOLD_ORE: 12,
  IRON_ORE: 13,
  COAL_ORE: 14,
  DIAMOND_ORE: 15,
  REDSTONE_ORE: 16,
  LOG: 17,
  LEAVES: 18,
  GLASS: 19,
  SANDSTONE: 20,
  WOOL: 21,
  FLOWER_RED: 22,
  FLOWER_YELLOW: 23,
  TALL_GRASS: 24,
  MUSHROOM_RED: 25,
  TORCH: 26,
  CRAFTING_TABLE: 27,
  FURNACE: 28,
  CHEST: 29,
  SNOW: 30,
  ICE: 31,
  CACTUS: 32,
  BRICKS: 33,
  STONE_BRICKS: 34,
  OBSIDIAN: 35,
  BOOKSHELF: 36,
  MOSSY_COBBLE: 37,
  CLAY: 38,
  FARMLAND: 39,
  WHEAT: 40,
  LADDER: 41,
  BIRCH_LOG: 42,
  BIRCH_LEAVES: 43,
  SPRUCE_LOG: 44,
  SPRUCE_LEAVES: 45,
  STICK: 200,      // Items (keine Blöcke)
  COAL: 201,
  IRON_INGOT: 202,
  GOLD_INGOT: 203,
  DIAMOND: 204,
  REDSTONE: 205,
  WOOD_PICKAXE: 210,
  STONE_PICKAXE: 211,
  IRON_PICKAXE: 212,
  DIAMOND_PICKAXE: 213,
  WOOD_AXE: 214,
  STONE_AXE: 215,
  IRON_AXE: 216,
  DIAMOND_AXE: 217,
  WOOD_SHOVEL: 218,
  STONE_SHOVEL: 219,
  IRON_SHOVEL: 220,
  DIAMOND_SHOVEL: 221,
  WOOD_SWORD: 222,
  STONE_SWORD: 223,
  IRON_SWORD: 224,
  DIAMOND_SWORD: 225,
  WOOD_HOE: 226,
  STONE_HOE: 227,
  IRON_HOE: 228,
  DIAMOND_HOE: 229,
  APPLE: 230,
  BREAD: 231,
  PORKCHOP: 232,
  COOKED_PORKCHOP: 233,
  BEEF: 234,
  COOKED_BEEF: 235,
  CHICKEN: 236,
  COOKED_CHICKEN: 237,
  SEEDS: 240,
  WHEAT_ITEM: 241,
  LEATHER: 242,
  FEATHER: 243,
  BONE: 244,
  BONE_MEAL: 245,
  CHARCOAL: 246,
  SUGAR_CANE: 250,
};

// Render-Typen
export const RENDER = {
  CUBE: 'cube',        // normaler Vollblock
  CROSS: 'cross',      // X-förmige Pflanzen
  TORCH: 'torch',      // Fackel (schlank)
  WATER: 'water',      // transparent, animiert
  LEAVES: 'leaves',    // dichtes Blattwerk
  GLASS: 'glass',      // transparent, glatt
  CROP: 'crop',        // Pflanzen mit Wachstumsstufen
  LADDER: 'ladder',
};

// Werkzeug-Klassen
export const TOOL = {
  NONE: 'none',
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
  SWORD: 'sword',
  HOE: 'hoe',
};

/**
 * Block-Definitionen.
 * tiles: [top, side, bottom] — Indizes in der Textur-Atlas-16x16-Kachel-Rasterung.
 * hardness: Sekunden Basisabbauzeit; toolSpeed: Multiplikator mit passendem Werkzeug.
 */
function def(id, name, opts) {
  return {
    id,
    name,
    render: RENDER.CUBE,
    solid: true,
    transparent: false,
    light: 0,
    hardness: 1,
    tool: TOOL.NONE,
    toolLevel: 0,        // 0: Hand, 1: Holz, 2: Stein, 3: Eisen, 4: Diamant
    toolSpeed: 1,
    drops: null,         // null = sich selbst
    dropCount: 1,
    gravity: false,
    flammable: false,
    climbable: false,
    food: 0,
    maxStack: 64,
    ...opts,
  };
}

export const BLOCKS = {};
function reg(block) {
  BLOCKS[block.id] = block;
  return block;
}

// ---- Natur & Terrain -------------------------------------------------------
reg(def(BLOCK.AIR, 'Luft', { solid: false, transparent: true, render: RENDER.CUBE, hardness: 0 }));
reg(def(BLOCK.STONE, 'Stein', {
  tiles: [2, 2, 2], hardness: 1.5, tool: TOOL.PICKAXE, toolLevel: 1,
  drops: BLOCK.COBBLESTONE,
}));
reg(def(BLOCK.GRASS, 'Grasblock', {
  tiles: [0, 1, 3], hardness: 0.6, tool: TOOL.SHOVEL, drops: BLOCK.DIRT,
}));
reg(def(BLOCK.DIRT, 'Erde', {
  tiles: [3, 3, 3], hardness: 0.5, tool: TOOL.SHOVEL,
}));
reg(def(BLOCK.COBBLESTONE, 'Bruchstein', {
  tiles: [4, 4, 4], hardness: 2, tool: TOOL.PICKAXE, toolLevel: 1,
}));
reg(def(BLOCK.BEDROCK, 'Grundgestein', {
  tiles: [5, 5, 5], hardness: -1, drops: null,
}));
reg(def(BLOCK.SAND, 'Sand', {
  tiles: [6, 6, 6], hardness: 0.5, tool: TOOL.SHOVEL, gravity: true,
}));
reg(def(BLOCK.GRAVEL, 'Kies', {
  tiles: [7, 7, 7], hardness: 0.6, tool: TOOL.SHOVEL, gravity: true,
  drops: BLOCK.GRAVEL,
}));
reg(def(BLOCK.SANDSTONE, 'Sandstein', {
  tiles: [8, 9, 10], hardness: 0.8, tool: TOOL.PICKAXE, toolLevel: 1,
}));
reg(def(BLOCK.CLAY, 'Lehm', {
  tiles: [11, 11, 11], hardness: 0.6, tool: TOOL.SHOVEL,
}));
reg(def(BLOCK.SNOW, 'Schnee', {
  tiles: [12, 13, 3], hardness: 0.6, tool: TOOL.SHOVEL,
}));
reg(def(BLOCK.ICE, 'Eis', {
  tiles: [14, 14, 14], hardness: 0.5, tool: TOOL.PICKAXE, transparent: true, render: RENDER.GLASS,
}));
reg(def(BLOCK.OBSIDIAN, 'Obsidian', {
  tiles: [15, 15, 15], hardness: 9, tool: TOOL.PICKAXE, toolLevel: 4,
}));

// ---- Flüssigkeiten --------------------------------------------------------
reg(def(BLOCK.WATER, 'Wasser', {
  tiles: [16, 16, 16], solid: false, transparent: true, render: RENDER.WATER,
  hardness: -1, drops: null,
}));
reg(def(BLOCK.LAVA, 'Lava', {
  tiles: [17, 17, 17], solid: false, transparent: true, render: RENDER.WATER,
  hardness: -1, drops: null, light: 15,
}));

// ---- Erze -----------------------------------------------------------------
reg(def(BLOCK.COAL_ORE, 'Kohleerz', {
  tiles: [18, 18, 18], hardness: 3, tool: TOOL.PICKAXE, toolLevel: 1, drops: BLOCK.COAL,
}));
reg(def(BLOCK.IRON_ORE, 'Eisenerz', {
  tiles: [19, 19, 19], hardness: 3, tool: TOOL.PICKAXE, toolLevel: 2,
}));
reg(def(BLOCK.GOLD_ORE, 'Golderz', {
  tiles: [20, 20, 20], hardness: 3, tool: TOOL.PICKAXE, toolLevel: 3,
}));
reg(def(BLOCK.DIAMOND_ORE, 'Diamanterz', {
  tiles: [21, 21, 21], hardness: 3, tool: TOOL.PICKAXE, toolLevel: 3, drops: BLOCK.DIAMOND,
}));
reg(def(BLOCK.REDSTONE_ORE, 'Redstoneerz', {
  tiles: [22, 22, 22], hardness: 3, tool: TOOL.PICKAXE, toolLevel: 3,
  drops: BLOCK.REDSTONE, dropCount: 4,
}));

// ---- Holz -----------------------------------------------------------------
reg(def(BLOCK.LOG, 'Eichenstamm', {
  tiles: [24, 23, 24], hardness: 2, tool: TOOL.AXE, flammable: true,
}));
reg(def(BLOCK.LEAVES, 'Eichenlaub', {
  tiles: [25, 25, 25], hardness: 0.2, render: RENDER.LEAVES, transparent: false,
  flammable: true, drops: null,
}));
reg(def(BLOCK.BIRCH_LOG, 'Birkenstamm', {
  tiles: [27, 26, 27], hardness: 2, tool: TOOL.AXE, flammable: true,
}));
reg(def(BLOCK.BIRCH_LEAVES, 'Birkenlaub', {
  tiles: [28, 28, 28], hardness: 0.2, render: RENDER.LEAVES, transparent: false,
  flammable: true, drops: null,
}));
reg(def(BLOCK.SPRUCE_LOG, 'Fichtenstamm', {
  tiles: [30, 29, 30], hardness: 2, tool: TOOL.AXE, flammable: true,
}));
reg(def(BLOCK.SPRUCE_LEAVES, 'Fichtenlaub', {
  tiles: [31, 31, 31], hardness: 0.2, render: RENDER.LEAVES, transparent: false,
  flammable: true, drops: null,
}));
reg(def(BLOCK.PLANKS, 'Holzbretter', {
  tiles: [32, 32, 32], hardness: 2, tool: TOOL.AXE, flammable: true,
}));
reg(def(BLOCK.SAPLING, 'Setzling', {
  tiles: [33, 33, 33], solid: false, transparent: true, render: RENDER.CROSS,
  hardness: 0, flammable: true,
}));
reg(def(BLOCK.BOOKSHELF, 'Bücherregal', {
  tiles: [32, 34, 32], hardness: 1.5, tool: TOOL.AXE, flammable: true,
}));

// ---- Pflanzen -------------------------------------------------------------
reg(def(BLOCK.FLOWER_RED, 'Roter Mohn', {
  tiles: [35, 35, 35], solid: false, transparent: true, render: RENDER.CROSS, hardness: 0,
}));
reg(def(BLOCK.FLOWER_YELLOW, 'Gelbe Blume', {
  tiles: [36, 36, 36], solid: false, transparent: true, render: RENDER.CROSS, hardness: 0,
}));
reg(def(BLOCK.TALL_GRASS, 'Gras', {
  tiles: [37, 37, 37], solid: false, transparent: true, render: RENDER.CROSS,
  hardness: 0, drops: BLOCK.SEEDS,
}));
reg(def(BLOCK.MUSHROOM_RED, 'Roter Pilz', {
  tiles: [38, 38, 38], solid: false, transparent: true, render: RENDER.CROSS, hardness: 0,
}));
reg(def(BLOCK.WHEAT, 'Weizen', {
  tiles: [93, 93, 93], solid: false, transparent: true, render: RENDER.CROP,
  hardness: 0, drops: BLOCK.WHEAT_ITEM,
  cropTiles: [93, 94, 95, 96],
}));
reg(def(BLOCK.CACTUS, 'Kaktus', {
  tiles: [41, 40, 41], hardness: 0.4, transparent: true,
}));
reg(def(BLOCK.SUGAR_CANE, 'Zuckerrohr', {
  tiles: [42, 42, 42], solid: false, transparent: true, render: RENDER.CROSS, hardness: 0,
}));

// ---- Bau-Blöcke -----------------------------------------------------------
reg(def(BLOCK.GLASS, 'Glas', {
  tiles: [43, 43, 43], hardness: 0.3, transparent: true, render: RENDER.GLASS, drops: null,
}));
reg(def(BLOCK.WOOL, 'Wolle', {
  tiles: [44, 44, 44], hardness: 0.8,
}));
reg(def(BLOCK.BRICKS, 'Ziegelsteine', {
  tiles: [45, 45, 45], hardness: 2, tool: TOOL.PICKAXE, toolLevel: 1,
}));
reg(def(BLOCK.STONE_BRICKS, 'Steinziegel', {
  tiles: [46, 46, 46], hardness: 2, tool: TOOL.PICKAXE, toolLevel: 1,
}));
reg(def(BLOCK.MOSSY_COBBLE, 'Moosiges Bruchstein', {
  tiles: [47, 47, 47], hardness: 2, tool: TOOL.PICKAXE, toolLevel: 1,
}));
reg(def(BLOCK.FARMLAND, 'Ackerboden', {
  tiles: [48, 49, 3], hardness: 0.6, tool: TOOL.SHOVEL, drops: BLOCK.DIRT,
}));
reg(def(BLOCK.LADDER, 'Leiter', {
  tiles: [50, 50, 50], solid: false, transparent: true, render: RENDER.LADDER,
  hardness: 0.4, tool: TOOL.AXE, climbable: true,
}));

// ---- Funktions-Blöcke -----------------------------------------------------
reg(def(BLOCK.TORCH, 'Fackel', {
  tiles: [51, 51, 51], solid: false, transparent: true, render: RENDER.TORCH,
  hardness: 0, light: 14, equipmentSlot: 'offhand',
}));
reg(def(BLOCK.CRAFTING_TABLE, 'Werkbank', {
  tiles: [32, 52, 32], hardness: 2.5, tool: TOOL.AXE, flammable: true,
}));
reg(def(BLOCK.FURNACE, 'Schmelzofen', {
  tiles: [53, 54, 53], hardness: 3.5, tool: TOOL.PICKAXE, toolLevel: 1,
}));
reg(def(BLOCK.CHEST, 'Truhe', {
  tiles: [55, 56, 55], hardness: 2.5, tool: TOOL.AXE, flammable: true,
}));

// ---- Items ----------------------------------------------------------------
function item(id, name, opts = {}) {
  return reg({
    id, name,
    render: 'item', solid: false, transparent: true,
    hardness: 0, tool: TOOL.NONE, toolLevel: 0, toolSpeed: 1,
    drops: null, dropCount: 1, maxStack: 64, food: 0, damage: 0, durability: 0,
    ...opts,
  });
}

item(BLOCK.STICK, 'Stock', { tiles: [57] });
item(BLOCK.COAL, 'Kohle', { tiles: [58] });
item(BLOCK.CHARCOAL, 'Holzkohle', { tiles: [101] });
item(BLOCK.IRON_INGOT, 'Eisenbarren', { tiles: [59] });
item(BLOCK.GOLD_INGOT, 'Goldbarren', { tiles: [60] });
item(BLOCK.DIAMOND, 'Diamant', { tiles: [61] });
item(BLOCK.REDSTONE, 'Redstone', { tiles: [62] });
item(BLOCK.SEEDS, 'Samen', { tiles: [63] });
item(BLOCK.WHEAT_ITEM, 'Weizen', { tiles: [64] });
item(BLOCK.LEATHER, 'Leder', { tiles: [65] });
item(BLOCK.FEATHER, 'Feder', { tiles: [66] });
item(BLOCK.BONE, 'Knochen', { tiles: [67] });
item(BLOCK.BONE_MEAL, 'Knochenmehl', { tiles: [68] });

item(BLOCK.APPLE, 'Apfel', { tiles: [69], food: 4 });
item(BLOCK.BREAD, 'Brot', { tiles: [70], food: 5 });
item(BLOCK.PORKCHOP, 'Rohes Schweinefleisch', { tiles: [71], food: 3 });
item(BLOCK.COOKED_PORKCHOP, 'Gebratenes Schweinefleisch', { tiles: [72], food: 8 });
item(BLOCK.BEEF, 'Rohes Rindfleisch', { tiles: [73], food: 3 });
item(BLOCK.COOKED_BEEF, 'Steak', { tiles: [74], food: 8 });
item(BLOCK.CHICKEN, 'Rohes Hühnchen', { tiles: [75], food: 2 });
item(BLOCK.COOKED_CHICKEN, 'Gebratenes Hühnchen', { tiles: [76], food: 6 });

function tool(id, name, toolType, level, speed, damage, durability, tile) {
  return item(id, name, {
    tiles: [tile], tool: toolType, toolLevel: level, toolSpeed: speed,
    damage, durability, maxStack: 1,
  });
}

tool(BLOCK.WOOD_PICKAXE, 'Holzspitzhacke', TOOL.PICKAXE, 1, 2, 2, 60, 77);
tool(BLOCK.STONE_PICKAXE, 'Steinspitzhacke', TOOL.PICKAXE, 2, 4, 3, 132, 78);
tool(BLOCK.IRON_PICKAXE, 'Eisenspitzhacke', TOOL.PICKAXE, 3, 6, 4, 251, 79);
tool(BLOCK.DIAMOND_PICKAXE, 'Diamantspitzhacke', TOOL.PICKAXE, 4, 8, 5, 1562, 80);
tool(BLOCK.WOOD_AXE, 'Holzaxt', TOOL.AXE, 1, 2, 3, 60, 81);
tool(BLOCK.STONE_AXE, 'Steinaxt', TOOL.AXE, 2, 4, 4, 132, 82);
tool(BLOCK.IRON_AXE, 'Eisenaxt', TOOL.AXE, 3, 6, 5, 251, 83);
tool(BLOCK.DIAMOND_AXE, 'Diamantaxt', TOOL.AXE, 4, 8, 6, 1562, 84);
tool(BLOCK.WOOD_SHOVEL, 'Holzschaufel', TOOL.SHOVEL, 1, 2, 1, 60, 85);
tool(BLOCK.STONE_SHOVEL, 'Steinschaufel', TOOL.SHOVEL, 2, 4, 1, 132, 86);
tool(BLOCK.IRON_SHOVEL, 'Eisenschaufel', TOOL.SHOVEL, 3, 6, 1, 251, 87);
tool(BLOCK.DIAMOND_SHOVEL, 'Diamantschaufel', TOOL.SHOVEL, 4, 8, 1, 1562, 88);
tool(BLOCK.WOOD_SWORD, 'Holzschwert', TOOL.SWORD, 1, 1.5, 4, 60, 89);
tool(BLOCK.STONE_SWORD, 'Steinschwert', TOOL.SWORD, 2, 1.5, 5, 132, 90);
tool(BLOCK.IRON_SWORD, 'Eisenschwert', TOOL.SWORD, 3, 1.5, 6, 251, 91);
tool(BLOCK.DIAMOND_SWORD, 'Diamantschwert', TOOL.SWORD, 4, 1.5, 7, 1562, 92);
tool(BLOCK.WOOD_HOE, 'Holzhacke', TOOL.HOE, 1, 1, 1, 60, 97);
tool(BLOCK.STONE_HOE, 'Steinhacke', TOOL.HOE, 2, 1, 1, 132, 98);
tool(BLOCK.IRON_HOE, 'Eisenhacke', TOOL.HOE, 3, 1, 1, 251, 99);
tool(BLOCK.DIAMOND_HOE, 'Diamanthacke', TOOL.HOE, 4, 1, 1, 1562, 100);

// Wachstumsstufen für Weizen (0..3)
export const CROP_STAGES = 3;

/** Ist der Block ein Platzierbarer Block (kein reines Item)? */
export function isPlaceable(id) {
  return id < 200;
}

/** Ist der Block kollidierbar? */
export function isSolid(id) {
  const b = BLOCKS[id];
  return b ? b.solid : false;
}

/** Ist der Block transparent (für Face-Culling / Licht)? */
export function isTransparent(id) {
  const b = BLOCKS[id];
  return b ? b.transparent : true;
}

/** Block bricht Licht (undurchsichtig)? */
export function isOpaque(id) {
  const b = BLOCKS[id];
  return b ? !b.transparent && b.solid : false;
}

/** Wie schnell baut der Spieler diesen Block ab (Fortschritt pro Sekunde)? */
export function breakSpeed(id, heldTool) {
  const b = BLOCKS[id];
  if (!b || b.hardness < 0) return 0;
  if (b.hardness === 0) return 1000;
  let speed = 1;
  const toolDef = heldTool != null ? BLOCKS[heldTool] : null;
  if (toolDef && toolDef.tool === b.tool && b.tool !== TOOL.NONE) {
    speed = toolDef.toolSpeed;
    // Richtige Werkzeugstufe nötig?
    if (b.toolLevel > 0 && toolDef.toolLevel < b.toolLevel) {
      speed = 1; // Abbau möglich, aber langsam und ohne Drop-Chance-Bonus
    }
  }
  return speed / b.hardness;
}

/** Drop-Item-ID und -Anzahl ermitteln (inkl. Werkzeug-Stufe-Check). */
export function getDrop(id, heldTool) {
  const b = BLOCKS[id];
  if (!b) return null;
  if (b.hardness < 0) return null; // Bedrock, Wasser …
  const toolDef = heldTool != null ? BLOCKS[heldTool] : null;
  // Erze brauchen die passende Spitzhacken-Stufe
  if (b.tool === TOOL.PICKAXE && b.toolLevel > 0) {
    const lvl = toolDef && toolDef.tool === TOOL.PICKAXE ? toolDef.toolLevel : 0;
    if (lvl < b.toolLevel) return null; // kein Drop ohne passendes Werkzeug
  }
  const dropId = b.drops != null ? b.drops : id;
  if (dropId === BLOCK.AIR) return null;
  return { id: dropId, count: b.dropCount || 1 };
}

/** Deutsche Item-/Blocknamen. */
export function getName(id) {
  return BLOCKS[id] ? BLOCKS[id].name : `Unbekannt (${id})`;
}
