// game.test.mjs — Tests für Inventar, Crafting, Spielerphysik, Speichern.
import { Inventory, matchRecipe, makeStack, listRecipes, HOTBAR_SIZE } from '../src/player/inventory.js';
import { BLOCKS, BLOCK, TOOL, breakSpeed, getDrop } from '../src/world/blocks.js';
import { Player, PHYS, PLAYER_HEIGHT } from '../src/player/player.js';
import { World } from '../src/world/world.js';
import { CHUNK_SIZE, blockIndex } from '../src/world/chunk.js';
import { Interaction } from '../src/player/interaction.js';
import { BlockOutline } from '../src/ui/block-outline.js';

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FEHL:', msg); }
}

// ---- Inventar --------------------------------------------------------------
const inv = new Inventory();
ok(inv.slots.length === 36, 'Inventar hat 36 Slots');
ok(inv.add(BLOCK.DIRT, 10) === 0, '10 Erde aufgenommen');
ok(inv.count(BLOCK.DIRT) === 10, 'Erde gezählt');
ok(inv.add(BLOCK.DIRT, 70) === 0, '70 Erde: 54 in den ersten Stapel + 16 in neuen Slot');
ok(inv.count(BLOCK.DIRT) === 80, 'Erde gesamt 80');
ok(inv.consume(BLOCK.DIRT, 16) === true, '16 Erde verbraucht');
ok(inv.count(BLOCK.DIRT) === 64, '64 Erde übrig');
ok(inv.consume(BLOCK.DIRT, 100) === false, 'Zu viel verbrauchen schlägt fehl');

// Tools stapeln nicht
const inv2 = new Inventory();
inv2.add(BLOCK.WOOD_PICKAXE, 1);
inv2.add(BLOCK.WOOD_PICKAXE, 1);
ok(inv2.count(BLOCK.WOOD_PICKAXE) === 2, 'Zwei Pickaxes im Inventar');
ok(inv2.slots[0].id === BLOCK.WOOD_PICKAXE && inv2.slots[1].id === BLOCK.WOOD_PICKAXE, 'In eigenen Slots');
ok(inv2.slots[0].dur === 60, 'Haltbarkeit voll');

// Haltbarkeit
inv2.selected = 0;
const broken = inv2.damageHeld(60);
ok(broken === null && inv2.slots[0] === null, 'Werkzeug zerbricht bei 0 Haltbarkeit');

// Slots tauschen
const inv3 = new Inventory();
inv3.setSlot(5, makeStack(BLOCK.STONE, 10));
inv3.setSlot(6, makeStack(BLOCK.SAND, 5));
inv3.swapSlots(5, 6);
ok(inv3.getSlot(5).id === BLOCK.SAND && inv3.getSlot(6).id === BLOCK.STONE, 'Slot-Tausch');

// Stapel vereinen
inv3.setSlot(7, makeStack(BLOCK.STONE, 50));
inv3.swapSlots(6, 7);
ok(inv3.getSlot(7).count === 60, `Stapel vereint (60) — ist ${inv3.getSlot(7)?.count}`);
ok(inv3.getSlot(6) === null, 'Quell-Slot leer nach Vereinen');

// ---- Crafting --------------------------------------------------------------
const grid = (ids) => ids.map((id) => (id ? makeStack(id, 1) : null));
// 1 Log → 4 Bretter (shapeless)
ok(matchRecipe(grid([BLOCK.LOG, null, null, null, null, null, null, null, null]))?.id === BLOCK.PLANKS, 'Log → Bretter');
// 2 Bretter übereinander → 4 Stöcke
ok(matchRecipe(grid([BLOCK.PLANKS, null, null, BLOCK.PLANKS, null, null, null, null, null]))?.count === 4, 'Bretter → Stöcke');
// 2x2 Bretter → Werkbank
ok(matchRecipe(grid([BLOCK.PLANKS, BLOCK.PLANKS, null, BLOCK.PLANKS, BLOCK.PLANKS, null, null, null, null]))?.id === BLOCK.CRAFTING_TABLE, 'Werkbank');
// Spitzhacke
const pickGrid = grid([
  BLOCK.PLANKS, BLOCK.PLANKS, BLOCK.PLANKS,
  null, BLOCK.STICK, null,
  null, BLOCK.STICK, null,
]);
ok(matchRecipe(pickGrid)?.id === BLOCK.WOOD_PICKAXE, 'Holzspitzhacke');
// Eisen-Schwert
const swordGrid = grid([
  null, BLOCK.IRON_INGOT, null,
  null, BLOCK.IRON_INGOT, null,
  null, BLOCK.STICK, null,
]);
ok(matchRecipe(swordGrid)?.id === BLOCK.IRON_SWORD, 'Eisenschwert');
// Fackeln (Kohle über Stock)
const torchGrid = grid([null, BLOCK.COAL, null, null, BLOCK.STICK, null, null, null, null]);
ok(matchRecipe(torchGrid)?.id === BLOCK.TORCH && matchRecipe(torchGrid)?.count === 4, 'Fackeln ×4');
// Brot
const breadGrid = grid([BLOCK.WHEAT_ITEM, BLOCK.WHEAT_ITEM, BLOCK.WHEAT_ITEM, null, null, null, null, null, null]);
ok(matchRecipe(breadGrid)?.id === BLOCK.BREAD, 'Brot aus 3 Weizen');
// Ofen
const furnaceGrid = grid([
  BLOCK.COBBLESTONE, BLOCK.COBBLESTONE, BLOCK.COBBLESTONE,
  BLOCK.COBBLESTONE, null, BLOCK.COBBLESTONE,
  BLOCK.COBBLESTONE, BLOCK.COBBLESTONE, BLOCK.COBBLESTONE,
]);
ok(matchRecipe(furnaceGrid)?.id === BLOCK.FURNACE, 'Schmelzofen');
// Spiegelung (Axt)
const axeGrid = grid([
  BLOCK.PLANKS, BLOCK.PLANKS, null,
  BLOCK.PLANKS, BLOCK.STICK, null,
  null, BLOCK.STICK, null,
]);
ok(matchRecipe(axeGrid)?.id === BLOCK.WOOD_AXE, 'Axt (auch gespiegelt)');
// Kein Rezept
ok(matchRecipe(grid([BLOCK.STONE, null, null, null, null, null, null, null, null])) === null, 'Kein Rezept für einzelnen Stein');
// Leeres Raster
ok(matchRecipe(grid([null, null, null, null, null, null, null, null, null])) === null, 'Leeres Raster');
// Rezeptliste vollständig
const recipes = listRecipes();
ok(recipes.length >= 30, `Rezeptbuch hat ${recipes.length} Rezepte (>= 30)`);

// ---- Spielerphysik ---------------------------------------------------------
const world = new World(4242, 'flat', {});
// Flachwelt: Gras bei y=32
for (let i = 0; i < 3; i++) world.update(8, 8, 1, 100);

const player = new Player(world);
player.onGround = true;
player.inWater = true;
player.sneaking = true;
player.teleport(8.5, 38, 8.5);
ok(!player.onGround && !player.inWater && !player.sneaking,
  'Teleport setzt veralteten Boden-, Wasser- und Schleichenstatus zurück');
const input = { forward: 0, right: 0, jump: false, sneak: false, sprint: false };

// Gravitation: fällt nach unten
for (let i = 0; i < 120; i++) player.update(1 / 60, input);
ok(player.onGround, `Spieler landet auf dem Boden (y=${player.position.y.toFixed(2)})`);
ok(Math.abs(player.position.y - 33) < 0.1, `Höhe ≈ 33 (auf Gras y=32): ${player.position.y.toFixed(2)}`);

// Springen
input.jump = true;
player.update(1 / 60, input);
input.jump = false;
ok(player.velocity.y > 0 || player.position.y > 33.1, 'Sprung hebt Spieler');
let maxY = player.position.y;
for (let i = 0; i < 120; i++) {
  player.update(1 / 60, input);
  maxY = Math.max(maxY, player.position.y);
}
ok(maxY > 33.8 && maxY < 35.5, `Sprunghöhe plausibel: ${(maxY - 33).toFixed(2)} Blöcke`);

// Laufen
input.forward = 1;
const startX = player.position.x;
for (let i = 0; i < 60; i++) player.update(1 / 60, input);
const moved = Math.hypot(player.position.x - startX, player.position.z - 8.5);
ok(moved > 2, `Vorwärtslaufen bewegt (${moved.toFixed(2)} Blöcke in 1 s)`);

// Kollision gegen Wand: Säule aus Stein
const wallX = Math.floor(startX) + 3;
for (let y = 33; y <= 34; y++) {
  world.setBlock(wallX, y, 8, BLOCK.STONE);
}
player.teleport(wallX - 3 + 0.5, 33, 8.5);
input.forward = 1;
player.yaw = -Math.PI / 2; // Blickrichtung +X
// lookDir bei yaw=-PI/2: x = -sin(-PI/2)=1 → bewegung nach +X mit forward
for (let i = 0; i < 180; i++) player.update(1 / 60, input);
ok(player.position.x < wallX + 0.01, `Wand stoppt Spieler (x=${player.position.x.toFixed(2)} < ${wallX + 0.01})`);
input.forward = 0;

// Fallschaden
player.teleport(8.5, 48, 8.5);
player.velocity = { x: 0, y: 0, z: 0 };
const hpBefore = player.health;
for (let i = 0; i < 300; i++) player.update(1 / 60, input);
ok(player.health < hpBefore || player.position.y <= 33.1, `Fallschaden oder Landung (HP ${player.health}, y=${player.position.y.toFixed(2)})`);
ok(player.fallDistance === 0, 'Fall-Distanz zurückgesetzt');

// Kreativflug: nach dem Abstieg am Boden muss Aufsteigen trotz aktivem Sneak-Toggle funktionieren.
player.gamemode = 'creative';
player.flying = true;
player.teleport(8.5, 38, 8.5);
player.flying = true;
input.jump = false;
input.sneak = true;
for (let i = 0; i < 120; i++) player.update(1 / 60, input);
const flightLandingY = player.position.y;
ok(player.onGround && Math.abs(flightLandingY - 33) < 0.1, 'Kreativflug-Abstieg landet sauber auf dem Boden');
input.jump = true; // Touch-Sneak bleibt bis zum nächsten Tap als Toggle aktiv.
for (let i = 0; i < 20; i++) player.update(1 / 60, input);
ok(player.position.y > flightLandingY + 0.3, 'Jump kann nach dem Abstieg trotz aktivem Sneak wieder aufsteigen');
player.gamemode = 'survival';
player.flying = false;
input.jump = false;
input.sneak = false;

// Schwimmen: Wasserbecken
for (let x = 6; x <= 11; x++) {
  for (let z = 6; z <= 11; z++) {
    world.setBlock(x, 33, z, BLOCK.WATER);
    world.setBlock(x, 34, z, BLOCK.WATER);
    world.setBlock(x, 35, z, BLOCK.WATER);
  }
}
player.teleport(8.5, 35, 8.5);
player.velocity = { x: 0, y: 0, z: 0 };
player.update(1 / 60, input);
ok(player.inWater, 'Spieler ist im Wasser');
input.jump = true;
for (let i = 0; i < 60; i++) player.update(1 / 60, input);
ok(player.velocity.y > -4, `Schwimmen bremst Fall (${player.velocity.y.toFixed(2)})`);
input.jump = false;

// Hunger-System
player.gamemode = 'survival';
player.health = 20;
player.hunger = 20;
player.eat(5);
ok(player.hunger === 20, 'Essen über Maximum bleibt bei 20');
player.hunger = 10;
player.eat(8);
ok(player.hunger === 18, 'Essen füllt Hunger');
player.health = 20;
player.invulnerableTime = 0;
player.takeDamage(3, 'test');
ok(player.health === 17, `Schaden reduziert Leben (${player.health})`);
player.invulnerableTime = 0;
player.takeDamage(3, 'test');
ok(player.health === 14, 'Erneuter Schaden nach Ablauf der Unverwundbarkeit');

// Unverwundbarkeit
player.takeDamage(5, 'test');
ok(player.health === 14, 'Schaden während Unverwundbarkeit blockiert');

// Tod & Respawn
player.health = 1;
player.invulnerableTime = 0;
player.takeDamage(10, 'test');
ok(player.dead, 'Spieler stirbt');
player.respawn({ x: 1, y: 40, z: 1 });
ok(!player.dead && player.health === 20, 'Respawn stellt Gesundheit wieder her');
player.gamemode = 'creative';
player.flying = true;
player.onGround = true;
player.respawn({ x: 2, y: 40, z: 2 });
ok(!player.flying && !player.onGround, 'Respawn beendet Flugmodus und setzt den Bodenkontakt zurück');

// Kreativmodus unverwundbar (außer Void)
player.gamemode = 'creative';
player.health = 20;
ok(player.takeDamage(5, 'zombie') === false, 'Kreativ: kein Mob-Schaden');

// ---- Serialisierung --------------------------------------------------------
const inv4 = new Inventory();
inv4.add(BLOCK.DIAMOND, 12);
inv4.add(BLOCK.IRON_PICKAXE, 1);
const json = JSON.parse(JSON.stringify(inv4.toJSON()));
const inv5 = new Inventory();
inv5.fromJSON(json);
ok(inv5.count(BLOCK.DIAMOND) === 12, 'Inventar-Serialisierung (Items)');
ok(inv5.count(BLOCK.IRON_PICKAXE) === 1, 'Inventar-Serialisierung (Werkzeug)');

player.gamemode = 'survival';
player.yaw = 1.23;
const pjson = JSON.parse(JSON.stringify(player.toJSON()));
const player2 = new Player(world);
player2.fromJSON(pjson);
ok(Math.abs(player2.yaw - 1.23) < 0.001, 'Spieler-Serialisierung (Yaw)');
ok(player2.gamemode === 'survival', 'Spieler-Serialisierung (Modus)');
player2.fromJSON({ gamemode: 'survival', flying: true });
ok(!player2.flying, 'Ältere/fehlerhafte Spielstände können Fliegen nicht im Survival aktivieren');
player2.fromJSON({ gamemode: 'creative', flying: true });
ok(player2.flying, 'Kreativflug bleibt beim Laden erhalten');

// ---- Welt: modifizierte Blöcke ---------------------------------------------
const w2 = new World(777, 'normal', {});
w2.generateChunk(0, 0);
w2.setBlock(3, 50, 3, BLOCK.GLASS);
const modified = [...w2.modified.entries()];
ok(modified.length === 1, 'Modifikation gespeichert');
const w3 = new World(777, 'normal', {});
for (const [pos, val] of w2.modified) {
  w3.modified.set(pos, val);
}
w3.generateChunk(0, 0);
ok(w3.getBlock(3, 50, 3) === BLOCK.GLASS, 'Modifikation nach Laden wiederhergestellt');

// Zielkontur: sichtbar am getroffenen Block, folgt dem nächsten Treffer und blendet ohne Ziel aus.
const outlineScene = {
  children: [],
  add(object) { this.children.push(object); },
  remove(object) { this.children = this.children.filter((entry) => entry !== object); },
};
const outline = new BlockOutline(outlineScene);
ok(outlineScene.children.includes(outline.mesh) && !outline.mesh.visible
  && outline.mesh.isLineSegments && outline.material.color.getHex() === 0x050505,
  'Einzelne schwarze Blockkontur wird anfangs verborgen in die Szene eingefügt');
ok(outline.material.depthTest && !outline.material.depthWrite && outline.mesh.renderOrder === 10,
  'Blockkontur blendet verdeckte Kanten per Tiefenprüfung aus');
outline.update({ x: 2, y: 5, z: -1 });
ok(outline.mesh.visible && outline.mesh.position.x === 2.5 && outline.mesh.position.y === 5.5 && outline.mesh.position.z === -0.5,
  'Blockkontur liegt zentriert um den angeschauten Block');
outline.update({ x: 3, y: 4, z: -1 });
ok(outline.mesh.position.x === 3.5 && outline.mesh.position.y === 4.5,
  'Blockkontur wechselt beim Umsehen direkt zum nächsten Ziel');
outline.update(null);
ok(!outline.mesh.visible, 'Blockkontur wird ohne Blockziel ausgeblendet');
outline.dispose();
ok(!outlineScene.children.includes(outline.mesh), 'Blockkontur gibt Szenenobjekte beim Dispose frei');

// Gedrückt gehaltenes Abbauen zielt pro Frame neu: nach dem ersten Block kann der Blick
// nach unten wechseln und der nächste Block wird ohne erneutes Drücken abgebaut.
const firstMineHit = { x: 3, y: 3, z: 3, id: BLOCK.DIRT, distance: 1, nx: 0, ny: 0, nz: -1 };
const lowerMineHit = { x: 3, y: 2, z: 3, id: BLOCK.DIRT, distance: 1, nx: 0, ny: 1, nz: 0 };
const aliveMineTargets = new Set(['3,3,3', '3,2,3']);
const minedTargets = [];
const aim = { direction: { x: 0, y: 0, z: -1 } };
const miningWorld = {
  raycast(_origin, direction) {
    const hit = direction.y < -0.5 ? lowerMineHit : firstMineHit;
    return aliveMineTargets.has(`${hit.x},${hit.y},${hit.z}`) ? hit : null;
  },
  setBlock(x, y, z, id) {
    if (id === BLOCK.AIR) {
      aliveMineTargets.delete(`${x},${y},${z}`);
      minedTargets.push(`${x},${y},${z}`);
    }
  },
  getBlock: () => BLOCK.AIR,
};
const miningPlayer = {
  gamemode: 'creative',
  attackCooldown: 0,
  exhaustion: 0,
  eyePosition: () => ({ x: 3.5, y: 4.5, z: 3.5 }),
  lookDir: () => aim.direction,
};
const miningMobs = { raycastMob: () => null, items: [], scene: { add() {} } };
const miningParticleCalls = [];
const miningParticles = { blockBreak(...args) { miningParticleCalls.push(args); } };
const miningAudio = { dig() {} };
const miningInteraction = new Interaction(
  miningWorld, miningPlayer, { held: () => null }, miningMobs, miningParticles, miningAudio,
);
const firstMineResult = miningInteraction.update(0.5, { attack: true }, null);
ok(firstMineResult.blockHit?.y === 3 && minedTargets[0] === '3,3,3',
  'Gedrückthalten baut den ersten Block ab');
ok(miningParticleCalls.some((call) => call[4] === 1)
  && miningParticleCalls.some((call) => call[4] === 14),
  'Bestehende Abbau- und Bruchpartikel bleiben neben den Rissen erhalten');
aim.direction = { x: 0, y: -1, z: 0 };
const nextMineResult = miningInteraction.update(0.5, { attack: true }, null);
ok(nextMineResult.blockHit?.y === 2 && minedTargets[1] === '3,2,3',
  'Blickwechsel nach unten baut den nächsten Block ohne Loslassen ab');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
