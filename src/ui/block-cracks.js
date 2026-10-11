// block-cracks.js — feste, pixelgenaue Minecraft-artige Abbaustufen.
import * as THREE from '../../lib/three.module.js';

const TEXTURE_SIZE = 16;
const CRACK_CORE = 'rgba(28,28,28,0.96)';
const CRACK_EDGE = 'rgba(112,112,112,0.82)';

// Ein einziges handgezeichnetes Bruchnetz wird stufenweise erweitert. Dadurch
// springen die Risse nicht zufällig über die Fläche und bleiben wie Minecraft
// in jeder Stufe pixelgenau gleich.
const CRACK_SEGMENTS = [
  // Startpunkt der ersten Stufe liegt in der Flächenmitte; zunächst nur drei Pixel.
  { stage: 0, points: [[7, 7], [8, 8], [9, 7]] },
  // Eine einzige Hauptfissur wächst schrittweise nach oben rechts weiter.
  { stage: 1, points: [[9, 7], [10, 6], [10, 5]] },
  { stage: 2, points: [[10, 5], [9, 4], [10, 3]] },
  // Erst ab Stufe drei kommt eine kurze, mit der Mitte verbundene Verzweigung hinzu.
  { stage: 3, points: [[8, 8], [7, 9], [6, 9]] },
  { stage: 4, points: [[6, 9], [5, 10], [4, 10]] },
  { stage: 5, points: [[10, 5], [11, 5], [12, 4]] },
  { stage: 6, points: [[12, 4], [12, 3], [13, 2]] },
  { stage: 7, points: [[9, 7], [9, 8], [10, 9]] },
  { stage: 8, points: [[10, 9], [11, 10], [12, 10]] },
  { stage: 9, points: [[7, 9], [7, 10], [8, 11], [9, 12]] },
];

function directionOf(points, index) {
  const before = points[Math.max(0, index - 1)];
  const after = points[Math.min(points.length - 1, index + 1)];
  return [Math.sign(after[0] - before[0]), Math.sign(after[1] - before[1])];
}

function renderStage(ctx, stage) {
  ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  ctx.imageSmoothingEnabled = false;

  const corePixels = new Set();
  const edgePixels = new Set();
  for (const segment of CRACK_SEGMENTS) {
    if (segment.stage > stage) continue;
    for (let i = 0; i < segment.points.length; i++) {
      const [x, y] = segment.points[i];
      corePixels.add(`${x},${y}`);
      const [dx, dy] = directionOf(segment.points, i);
      const edgeX = x + Math.sign(-dy);
      const edgeY = y + Math.sign(dx);
      if (edgeX >= 0 && edgeX < TEXTURE_SIZE && edgeY >= 0 && edgeY < TEXTURE_SIZE) {
        edgePixels.add(`${edgeX},${edgeY}`);
      }
    }
  }

  // Ein grauer Pixel neben dem dunklen Kern ergibt den körnigen, scharfkantigen
  // Bruch-Look der Vanilla-Texturen. Es werden nur 1×1-Pixel gesetzt.
  ctx.fillStyle = CRACK_EDGE;
  for (const pixel of edgePixels) {
    if (corePixels.has(pixel)) continue;
    const [x, y] = pixel.split(',').map(Number);
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = CRACK_CORE;
  for (const pixel of corePixels) {
    const [x, y] = pixel.split(',').map(Number);
    ctx.fillRect(x, y, 1, 1);
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

    // Vollflächige, coplanare Overlays; Tiefenbias löst Z-Fighting ohne Luftspalt.
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

  /** Fortschritt 0..1 auf eine der zehn festen Abbaustufen abbilden. */
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
    renderStage(this.context, stage);
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
