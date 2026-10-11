// block-outline.js — Kontrastreiche Hervorhebung des aktuell anvisierten Voxel-Blocks.
import * as THREE from '../../lib/three.module.js';

function makeBoxEdges(size) {
  const box = new THREE.BoxGeometry(size, size, size);
  const edges = new THREE.EdgesGeometry(box);
  box.dispose();
  return edges;
}

export class BlockOutline {
  constructor(scene) {
    // Zwei leicht versetzte Konturen bleiben sowohl auf hellen als auch auf dunklen
    // Blockoberflächen sichtbar; die Tiefenprüfung verdeckt die Rückkanten weiterhin.
    this.outerGeometry = makeBoxEdges(1.06);
    this.innerGeometry = makeBoxEdges(1.012);
    this.outerMaterial = new THREE.LineBasicMaterial({
      color: 0xffe45c,
      transparent: true,
      opacity: 0.98,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.innerMaterial = new THREE.LineBasicMaterial({
      color: 0x101010,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });

    this.mesh = new THREE.Group();
    this.outerLines = new THREE.LineSegments(this.outerGeometry, this.outerMaterial);
    this.innerLines = new THREE.LineSegments(this.innerGeometry, this.innerMaterial);
    for (const lines of [this.outerLines, this.innerLines]) {
      lines.renderOrder = 10;
      lines.frustumCulled = false;
      this.mesh.add(lines);
    }
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.scene = scene;
    this.scene.add(this.mesh);
  }

  /** Zeigt die Kontur um den getroffenen Block oder blendet sie aus. */
  update(hit) {
    if (!hit || !Number.isFinite(hit.x) || !Number.isFinite(hit.y) || !Number.isFinite(hit.z)) {
      this.hide();
      return;
    }
    this.mesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    this.mesh.visible = true;
  }

  hide() {
    this.mesh.visible = false;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.outerGeometry.dispose();
    this.innerGeometry.dispose();
    this.outerMaterial.dispose();
    this.innerMaterial.dispose();
  }
}
