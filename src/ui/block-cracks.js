// block-cracks.js — pixelige Minecraft-Abbaustufen auf allen sichtbaren Blockflächen.
import * as THREE from '../../lib/three.module.js';

const TEXTURE_SIZE = 16;
const DIRECTIONS = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];
// Feste Reihenfolge: jede neue Stufe ergänzt einen vorhandenen Pixelriss,
// statt das gesamte Muster um den Block herum springen zu lassen.
const RAY_ORDER = [0, 5, 2, 7, 4, 9, 1, 6, 3, 8];
const CRACK_CORE = 'rgba(24,24,24,0.96)';
const CRACK_EDGE = 'rgba(92,92,92,0.9)';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function chooseDirection(angle) {
  const steps = DIRECTIONS.map(([x, y]) => Math.atan2(y, x));
  let closest = 0;
  let distance = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const delta = Math.atan2(Math.sin(angle - steps[i]), Math.cos(angle - steps[i]));
    if (Math.abs(delta) < distance) {
      distance = Math.abs(delta);
      closest = i;
    }
  }
  return closest;
}

function walkCrack(startX, startY, direction, length, rand) {
  let x = startX;
  let y = startY;
  let heading = direction;
  const cells = [{ x, y, direction: heading }];
  for (let step = 0; step < length; step++) {
    // Minecraft-Risse folgen einem groben Pixelraster mit kurzen, kantigen Knicken.
    if (step > 0 && rand() < 0.42) {
      const turn = rand() < 0.5 ? -1 : 1;
      heading = (heading + turn + DIRECTIONS.length) % DIRECTIONS.length;
    }
    let [dx, dy] = DIRECTIONS[heading];
    let nextX = x + dx;
    let nextY = y + dy;
    if (nextX < 0 || nextX >= TEXTURE_SIZE || nextY < 0 || nextY >= TEXTURE_SIZE) {
      // Knicke Richtung Fläche, statt den Riss am Rand abzuschneiden.
      heading = (heading + (rand() < 0.5 ? 2 : -2) + DIRECTIONS.length) % DIRECTIONS.length;
      [dx, dy] = DIRECTIONS[heading];
      nextX = x + dx;
      nextY = y + dy;
      if (nextX < 0 || nextX >= TEXTURE_SIZE || nextY < 0 || nextY >= TEXTURE_SIZE) break;
    }
    x = nextX;
    y = nextY;
    cells.push({ x, y, direction: heading });
  }
  return cells;
}

function paintCrack(ctx, cells, rand) {
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const direction = DIRECTIONS[cell.direction];
    const sideX = Math.sign(-direction[1]);
    const sideY = Math.sign(direction[0]);

    // Ein versetzter grauer Pixel und ein dunkler Kern geben den Vanilla-Texturen
    // ihre harte, leicht reliefartige Kante, ohne weichgezeichnete Linien.
    if (rand() < 0.86) {
      const edgeX = cell.x + sideX;
      const edgeY = cell.y + sideY;
      if (edgeX >= 0 && edgeX < TEXTURE_SIZE && edgeY >= 0 && edgeY < TEXTURE_SIZE) {
        ctx.fillStyle = CRACK_EDGE;
        ctx.fillRect(edgeX, edgeY, 1, 1);
      }
    }
    ctx.fillStyle = CRACK_CORE;
    ctx.fillRect(cell.x, cell.y, 1, 1);
  }
}

export class BlockCracks {
  constructor(scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = TEXTURE_SIZE;
    this.context = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    // Die Textur ist genau eine Blockfläche groß und liegt ohne Luftspalt auf ihr.
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.96,
      depthTest: true,
      depthWrite: false,
      depthFunc: THREE.LessEqualDepth,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      toneMapped: false,
    });
    this.mesh = new THREE.Group();
    this.faces = [];
    const faceTransforms = [
      { position: [0.5, 0, 0], rotation: [0, Math.PI / 2, 0] },
      { position: [-0.5, 0, 0], rotation: [0, -Math.PI / 2, 0] },
      { position: [0, 0.5, 0], rotation: [-Math.PI / 2, 0, 0] },
      { position: [0, -0.5, 0], rotation: [Math.PI / 2, 0, 0] },
      { position: [0, 0, 0.5], rotation: [0, 0, 0] },
      { position: [0, 0, -0.5], rotation: [0, Math.PI, 0] },
    ];
    for (const face of faceTransforms) {
      const plane = new THREE.Mesh(this.geometry, this.material);
      plane.position.set(...face.position);
      plane.rotation.set(...face.rotation);
      plane.renderOrder = 11;
      plane.frustumCulled = false;
      this.mesh.add(plane);
      this.faces.push(plane);
    }
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.scene = scene;
    this.scene.add(this.mesh);
    this.stage = -1;
  }

  /** Fortschritt 0..1 auf eine der zehn pixeligen Vanilla-Abbaustufen abbilden. */
  update(hit, progress) {
    if (!hit || !Number.isFinite(hit.x) || !Number.isFinite(hit.y) || !Number.isFinite(hit.z)
      || !Number.isFinite(progress) || progress <= 0) {
      this.hide();
      return;
    }
    const stage = Math.min(9, Math.max(0, Math.floor(Math.min(1, progress) * 10)));
    if (stage !== this.stage) this._drawStage(stage);
    this.mesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    this.mesh.visible = true;
  }

  _drawStage(stage) {
    const ctx = this.context;
    ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    ctx.imageSmoothingEnabled = false;

    const rayCount = Math.min(RAY_ORDER.length, 2 + stage);
    const rayLength = 3 + stage;
    for (let ray = 0; ray < rayCount; ray++) {
      const rand = seededRandom(0x4d435241 + ray * 104729);
      const angle = (Math.PI * 2 * RAY_ORDER[ray] / RAY_ORDER.length) + (rand() - 0.5) * 0.56;
      const direction = chooseDirection(angle);
      const startX = 7 + Math.floor(rand() * 3);
      const startY = 7 + Math.floor(rand() * 3);
      const cells = walkCrack(startX, startY, direction, rayLength, rand);
      paintCrack(ctx, cells, rand);

      // Späte Stufen erhalten kurze Seitenrisse: das typische, dichter werdende
      // verzweigte Minecraft-Bruchmuster statt glatter, radialer Linien.
      const branchCount = Math.floor(stage / 3);
      for (let branch = 0; branch < branchCount && cells.length > 2; branch++) {
        const branchRand = seededRandom(0x51de + ray * 997 + stage * 37 + branch * 131);
        const parentIndex = 1 + Math.floor(branchRand() * (cells.length - 1));
        const parent = cells[parentIndex];
        const turn = branchRand() < 0.5 ? -2 : 2;
        const branchDirection = (parent.direction + turn + DIRECTIONS.length) % DIRECTIONS.length;
        const branchCells = walkCrack(parent.x, parent.y, branchDirection,
          Math.max(2, Math.floor(rayLength * (0.35 + branchRand() * 0.25))), branchRand);
        paintCrack(ctx, branchCells, branchRand);
      }
    }

    this.texture.needsUpdate = true;
    this.stage = stage;
  }

  hide() {
    this.mesh.visible = false;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
