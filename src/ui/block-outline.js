// block-outline.js — schwarze, tiefengeprüfte Kontur um den Zielblock.
import * as THREE from '../../lib/three.module.js';

export class BlockOutline {
  constructor(scene) {
    const box = new THREE.BoxGeometry(1.04, 1.04, 1.04);
    this.geometry = new THREE.EdgesGeometry(box);
    box.dispose();
    this.material = new THREE.LineBasicMaterial({
      color: 0x050505,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.LineSegments(this.geometry, this.material);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.scene = scene;
    this.scene.add(this.mesh);
  }

  /** Zeigt alle nicht verdeckten Würfelkanten des getroffenen Blocks. */
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
    this.geometry.dispose();
    this.material.dispose();
  }
}
