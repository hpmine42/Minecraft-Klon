// block-cracks.js — prozedurale Riss-Stufen auf allen sichtbaren Blockflächen.
import * as THREE from '../../lib/three.module.js';

const TEXTURE_SIZE = 96;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function drawCrack(ctx, points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = 'rgba(0,0,0,0.32)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.98)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
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

    this.geometry = new THREE.PlaneGeometry(0.92, 0.92);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.98,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      toneMapped: false,
    });
    this.mesh = new THREE.Group();
    this.faces = [];
    const faceTransforms = [
      { position: [0.505, 0, 0], rotation: [0, Math.PI / 2, 0] },
      { position: [-0.505, 0, 0], rotation: [0, -Math.PI / 2, 0] },
      { position: [0, 0.505, 0], rotation: [-Math.PI / 2, 0, 0] },
      { position: [0, -0.505, 0], rotation: [Math.PI / 2, 0, 0] },
      { position: [0, 0, 0.505], rotation: [0, 0, 0] },
      { position: [0, 0, -0.505], rotation: [0, Math.PI, 0] },
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

  /** Aktualisiert die sichtbaren Risse passend zum aktuellen Abbaufortschritt. */
  update(hit, progress) {
    if (!hit || !Number.isFinite(hit.x) || !Number.isFinite(hit.y) || !Number.isFinite(hit.z)
      || !Number.isFinite(progress) || progress <= 0) {
      this.hide();
      return;
    }
    const stage = Math.min(9, Math.max(0, Math.ceil(Math.min(1, progress) * 10) - 1));
    if (stage !== this.stage) this._drawStage(stage);
    this.mesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    this.mesh.visible = true;
  }

  _drawStage(stage) {
    const ctx = this.context;
    const size = TEXTURE_SIZE;
    const center = size / 2;
    const rand = seededRandom(0x51f15e + stage * 7919);
    ctx.clearRect(0, 0, size, size);

    const rayCount = 2 + stage;
    const baseLength = 12 + stage * 5.1;
    const drawRay = (startX, startY, startAngle, length, depth = 0) => {
      let x = startX;
      let y = startY;
      let angle = startAngle;
      const segments = Math.max(2, Math.ceil(length / 8));
      const stepLength = length / segments;
      const points = [{ x, y }];
      let branch = null;

      for (let i = 0; i < segments; i++) {
        angle += (rand() - 0.5) * 0.62;
        x = Math.max(2, Math.min(size - 2, x + Math.cos(angle) * stepLength));
        y = Math.max(2, Math.min(size - 2, y + Math.sin(angle) * stepLength));
        points.push({ x, y });
        if (!branch && depth < 2 && stage >= 2 && i > 0 && rand() < 0.32) {
          const side = rand() < 0.5 ? -1 : 1;
          branch = {
            x,
            y,
            angle: angle + side * (0.72 + rand() * 0.75),
            length: length * (0.28 + rand() * 0.22),
          };
        }
      }
      drawCrack(ctx, points);
      if (branch) drawRay(branch.x, branch.y, branch.angle, branch.length, depth + 1);
    };

    for (let i = 0; i < rayCount; i++) {
      const angle = (Math.PI * 2 * i / rayCount) + (rand() - 0.5) * 0.38;
      drawRay(center + (rand() - 0.5) * 5, center + (rand() - 0.5) * 5,
        angle, baseLength * (0.72 + rand() * 0.5));
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
