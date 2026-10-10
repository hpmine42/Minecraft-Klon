// world.js — Chunk-Verwaltung, Licht, Raycast, Block-Zugriff.
import * as THREE from '../../lib/three.module.js';
import { BLOCKS, BLOCK, RENDER, isOpaque, isTransparent } from './blocks.js';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, blockIndex, buildChunkGeometry } from './chunk.js';
import { WorldGen, SEA_LEVEL } from './worldgen.js';

export class World {
  /**
   * @param {number} seed
   * @param {string} worldType 'normal' | 'flat'
   * @param {object} materials { solid: THREE.Material, transparent: THREE.Material }
   */
  constructor(seed = 1337, worldType = 'normal', materials = null) {
    this.seed = seed >>> 0;
    this.worldType = worldType;
    this.gen = new WorldGen(this.seed, worldType);
    this.chunks = new Map();
    this.modified = new Map();     // "x,y,z" -> {id, meta} — Spieler-Änderungen
    this.materials = materials || {};
    this.meshQueue = [];
    this.chunksDirty = new Set();
  }

  static chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  getChunk(cx, cz) {
    return this.chunks.get(World.chunkKey(cx, cz));
  }

  getOrCreateChunk(cx, cz) {
    const key = World.chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  /** Chunk generieren (Terrain + Spieler-Änderungen anwenden). */
  generateChunk(cx, cz) {
    const chunk = this.getOrCreateChunk(cx, cz);
    if (chunk.generated) return chunk;
    this.gen.generate(chunk, this);
    // Gespeicherte Änderungen anwenden
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    for (const [key, val] of this.modified) {
      const [mx, my, mz] = key.split(',').map(Number);
      if (mx >= baseX && mx < baseX + CHUNK_SIZE && mz >= baseZ && mz < baseZ + CHUNK_SIZE) {
        const lx = mx - baseX;
        const lz = mz - baseZ;
        if (my >= 0 && my < CHUNK_HEIGHT) {
          chunk.blocks[blockIndex(lx, my, lz)] = val.id;
          chunk.meta[blockIndex(lx, my, lz)] = val.meta || 0;
        }
      }
    }
    this.recomputeLight(chunk);
    chunk.dirty = true;
    return chunk;
  }

  /** Block abfragen (Weltkoordinaten). Lädt/generiert Chunk bei Bedarf NICHT automatisch. */
  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return BLOCK.AIR;
    return chunk.blocks[blockIndex(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
  }

  /** Block abfragen ohne Seiteneffekte (für Generierung). */
  getBlockQuiet(x, y, z) {
    return this.getBlock(x, y, z);
  }

  getMeta(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return 0;
    return chunk.meta[blockIndex(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
  }

  getSkyLight(x, y, z) {
    if (y < 0) return 0;
    if (y >= CHUNK_HEIGHT) return 15;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return 15;
    return chunk.skyLight[blockIndex(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
  }

  getBlockLight(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return 0;
    return chunk.blockLight[blockIndex(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
  }

  /** Block setzen und Chunk-Markierungen/Änderungen verwalten. */
  setBlock(x, y, z, id, meta = 0, record = true) {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(cx, cz);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    const idx = blockIndex(lx, y, lz);
    chunk.blocks[idx] = id;
    chunk.meta[idx] = meta;
    chunk.dirty = true;
    chunk.lightDirty = true;

    if (record) {
      this.modified.set(`${x},${y},${z}`, { id, meta });
    }

    // Licht sofort neu berechnen (BFS über den Chunk ist günstig)
    this.recomputeLight(chunk);

    // Nachbarchunks an Grenzen neu einordnen
    const touch = [];
    if (lx === 0) touch.push([cx - 1, cz]);
    if (lx === CHUNK_SIZE - 1) touch.push([cx + 1, cz]);
    if (lz === 0) touch.push([cx, cz - 1]);
    if (lz === CHUNK_SIZE - 1) touch.push([cx, cz + 1]);
    for (const [ncx, ncz] of touch) {
      const n = this.getChunk(ncx, ncz);
      if (n) { n.dirty = true; n.lightDirty = true; }
    }
    return true;
  }

  /** Licht eines Chunks neu berechnen (Himmelslicht + Blocklicht, BFS). */
  recomputeLight(chunk) {
    const { blocks, skyLight, blockLight } = chunk;
    skyLight.fill(0);
    blockLight.fill(0);

    // Himmelslicht: von oben durchlässig durchfallen lassen
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        let light = 15;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const id = blocks[blockIndex(x, y, z)];
          const def = BLOCKS[id];
          if (id !== BLOCK.AIR && def && !def.transparent) {
            light = 0;
          }
          skyLight[blockIndex(x, y, z)] = light;
          if (light === 0) break;
        }
      }
    }

    // BFS-Verbreitung Himmelslicht
    this._spreadLight(chunk, skyLight, 15, true);

    // Blocklicht von Lichtquellen
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = blocks[blockIndex(x, y, z)];
          const def = BLOCKS[id];
          if (def && def.light > 0) {
            blockLight[blockIndex(x, y, z)] = def.light;
          }
        }
      }
    }
    this._spreadLight(chunk, blockLight, 0, false);
    chunk.lightDirty = false;
  }

  _spreadLight(chunk, lightArray, initial, isSky) {
    // Einfache BFS über den Chunk (+ Nachbarn via world.getBlock)
    const queue = [];
    const blocks = chunk.blocks;
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const v = lightArray[blockIndex(x, y, z)];
          if (v > 0) queue.push(x, y, z, v);
        }
      }
    }
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    let head = 0;
    while (head < queue.length) {
      const x = queue[head++], y = queue[head++], z = queue[head++], level = queue[head++];
      if (level <= 1) continue;
      const neighbors = [
        [x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1],
      ];
      for (const [nx, ny, nz] of neighbors) {
        if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
        if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue; // Chunk-lokal
        const ni = blockIndex(nx, ny, nz);
        const nid = blocks[ni];
        const ndef = BLOCKS[nid];
        const opaque = nid !== BLOCK.AIR && ndef && !ndef.transparent;
        if (opaque) continue;
        // Himmelslicht fällt nach unten ungeschwächt durch Luft
        let next = level - 1;
        if (isSky && ny === y - 1) next = level; // senkrecht nach unten
        if (lightArray[ni] < next) {
          lightArray[ni] = next;
          queue.push(nx, ny, nz, next);
        }
      }
    }
    // Licht an den Chunk-Rändern aus Nachbarn übernehmen (approximiert)
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          if (x > 0 && x < CHUNK_SIZE - 1 && z > 0 && z < CHUNK_SIZE - 1) continue;
          const wx = baseX + x;
          const wz = baseZ + z;
          const id = blocks[blockIndex(x, y, z)];
          const def = BLOCKS[id];
          if (id !== BLOCK.AIR && def && !def.transparent) continue;
          const neighborVals = [
            [wx + 1, y, wz], [wx - 1, y, wz], [wx, y, wz + 1], [wx, y, wz - 1],
          ];
          let best = lightArray[blockIndex(x, y, z)];
          for (const [ox, oy, oz] of neighborVals) {
            const nChunk = this.getChunk(Math.floor(ox / CHUNK_SIZE), Math.floor(oz / CHUNK_SIZE));
            if (!nChunk || !nChunk.generated) continue;
            const nId = nChunk.blocks[blockIndex(ox - Math.floor(ox / CHUNK_SIZE) * CHUNK_SIZE, oy, oz - Math.floor(oz / CHUNK_SIZE) * CHUNK_SIZE)];
            const nDef = BLOCKS[nId];
            if (nId !== BLOCK.AIR && nDef && !nDef.transparent) continue;
            const v = isSky
              ? nChunk.skyLight[blockIndex(ox - Math.floor(ox / CHUNK_SIZE) * CHUNK_SIZE, oy, oz - Math.floor(oz / CHUNK_SIZE) * CHUNK_SIZE)]
              : nChunk.blockLight[blockIndex(ox - Math.floor(ox / CHUNK_SIZE) * CHUNK_SIZE, oy, oz - Math.floor(oz / CHUNK_SIZE) * CHUNK_SIZE)];
            const next = Math.max(0, v - 1);
            if (next > best) best = next;
          }
          lightArray[blockIndex(x, y, z)] = best;
        }
      }
    }
  }

  /**
   * Chunks um eine Position laden/entladen, Meshes vorbereiten.
   * @returns {number} Anzahl der neu gebauten Meshes
   */
  update(playerX, playerZ, renderDistance, maxBuildMs = 6, maxGenerate = 3) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // Chunk unter dem Spieler IMMER zuerst (kein Durchfallen!)
    let generated = 0;
    const center = this.getChunk(pcx, pcz);
    if (!center || !center.generated) {
      this.generateChunk(pcx, pcz);
      generated++;
      for (const [ncx, ncz] of [[pcx + 1, pcz], [pcx - 1, pcz], [pcx, pcz + 1], [pcx, pcz - 1]]) {
        const n = this.getChunk(ncx, ncz);
        if (n && n.generated) n.dirty = true;
      }
    }

    // Weitere fehlende Chunks generieren (Budget pro Frame)
    for (let dz = -renderDistance; dz <= renderDistance && generated < maxGenerate; dz++) {
      for (let dx = -renderDistance; dx <= renderDistance && generated < maxGenerate; dx++) {
        if (dx * dx + dz * dz > (renderDistance + 0.5) * (renderDistance + 0.5)) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        const chunk = this.getChunk(cx, cz);
        if (!chunk || !chunk.generated) {
          this.generateChunk(cx, cz);
          generated++;
          const c = this.getChunk(cx, cz);
          c.dirty = true;
          // Nachbarn markieren (Ränder)
          for (const [ncx, ncz] of [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]]) {
            const n = this.getChunk(ncx, ncz);
            if (n && n.generated) n.dirty = true;
          }
        }
      }
    }

    // Entfernte Chunks entladen
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - pcx;
      const dz = chunk.cz - pcz;
      if (dx * dx + dz * dz > (renderDistance + 2) * (renderDistance + 2)) {
        this.disposeChunkMeshes(chunk);
        this.chunks.delete(key);
      }
    }

    // Meshes mit Zeitbudget bauen
    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let built = 0;
    for (const chunk of this.chunks.values()) {
      if (!chunk.dirty || !chunk.generated) continue;
      if (chunk.lightDirty) this.recomputeLight(chunk);
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (built > 0 && now - startTime > maxBuildMs) break;
      this.buildChunkMesh(chunk);
      built++;
    }
    return built;
  }

  /** Mesh eines Chunks erzeugen und in die Szene legen. */
  buildChunkMesh(chunk) {
    const { solid, transparent, fluidWater, fluidLava } = buildChunkGeometry(this, chunk);
    this._clearChunkMeshes(chunk);

    const addMesh = (geom, mat, order) => {
      if (!geom) return null;
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.renderOrder = order;
      if (this.materials.scene) this.materials.scene.add(mesh);
      return mesh;
    };

    chunk.meshSolid = addMesh(solid, this.materials.solid, 0);
    chunk.meshTransparent = addMesh(transparent, this.materials.transparent, 1);
    chunk.meshFluidWater = addMesh(fluidWater, this.materials.fluidWater, 2);
    chunk.meshFluidLava = addMesh(fluidLava, this.materials.fluidLava, 3);

    chunk.dirty = false;
    chunk.lightDirty = false;
  }

  _clearChunkMeshes(chunk) {
    for (const key of ['meshSolid', 'meshTransparent', 'meshFluidWater', 'meshFluidLava']) {
      const mesh = chunk[key];
      if (mesh) {
        if (this.materials.scene) this.materials.scene.remove(mesh);
        mesh.geometry.dispose();
        chunk[key] = null;
      }
    }
  }

  disposeChunkMeshes(chunk) {
    this._clearChunkMeshes(chunk);
  }

  /**
   * Voxel-Raycast (Amanatides & Woo).
   * @returns {{x,y,z,nx,ny,nz,distance,id}|null}
   */
  raycast(origin, direction, maxDistance = 6) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = direction.x > 0 ? 1 : -1;
    const stepY = direction.y > 0 ? 1 : -1;
    const stepZ = direction.z > 0 ? 1 : -1;

    const tDeltaX = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;

    let tMaxX = direction.x !== 0
      ? ((stepX > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX)
      : Infinity;
    let tMaxY = direction.y !== 0
      ? ((stepY > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY)
      : Infinity;
    let tMaxZ = direction.z !== 0
      ? ((stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ)
      : Infinity;

    let nx = 0, ny = 0, nz = 0;
    let distance = 0;

    while (distance <= maxDistance) {
      const id = this.getBlock(x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.LAVA) {
        const def = BLOCKS[id];
        if (def && (def.solid || def.render === RENDER.CROSS || def.render === RENDER.TORCH || def.render === RENDER.CROP || def.render === RENDER.LADDER)) {
          return { x, y, z, nx, ny, nz, distance, id };
        }
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        distance = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        distance = tMaxY;
        tMaxY += tDeltaY;
        nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ;
        distance = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }

  /** Oberflächenhöhe (für Spawn/Mobs). */
  heightAt(x, z) {
    return this.gen.heightAt(Math.floor(x), Math.floor(z));
  }

  /** Ist der Block an Position für Mobs begehbar-frei (2 Blöcke Luft)? */
  isSpaceFree(x, y, z) {
    return this.getBlock(x, y, z) === BLOCK.AIR && this.getBlock(x, y + 1, z) === BLOCK.AIR;
  }

  /** Alle Chunks-Statistiken (Debug). */
  stats() {
    let generated = 0;
    let dirty = 0;
    let solidVerts = 0;
    for (const c of this.chunks.values()) {
      if (c.generated) generated++;
      if (c.dirty) dirty++;
      if (c.meshSolid) solidVerts += c.meshSolid.geometry.attributes.position.count;
    }
    return { chunks: this.chunks.size, generated, dirty, solidVerts, modified: this.modified.size };
  }

  /** Alle Meshes neu aufbauen (nach Einstellungsänderung). */
  rebuildAll() {
    for (const chunk of this.chunks.values()) {
      if (chunk.generated) {
        chunk.dirty = true;
        this.buildChunkMesh(chunk);
      }
    }
  }
}

export { SEA_LEVEL };
