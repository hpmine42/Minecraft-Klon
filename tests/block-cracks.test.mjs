// block-cracks.test.mjs — Prozedurale Risse folgen dem Abbaufortschritt.
const context = {
  strokeCount: 0,
  clearRect() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() { this.strokeCount++; },
};
globalThis.document = {
  createElement(name) {
    if (name !== 'canvas') throw new Error(`Unerwartetes DOM-Element: ${name}`);
    return {
      width: 0,
      height: 0,
      getContext(type) { return type === '2d' ? context : null; },
    };
  },
};

const { BlockCracks } = await import('../src/ui/block-cracks.js');
let passed = 0;
let failed = 0;
function ok(condition, message) {
  if (condition) passed++;
  else { failed++; console.error(`FEHL: ${message}`); }
}

const scene = {
  children: [],
  add(object) { this.children.push(object); },
  remove(object) { this.children = this.children.filter((entry) => entry !== object); },
};
const cracks = new BlockCracks(scene);
ok(scene.children.includes(cracks.mesh) && !cracks.mesh.visible && cracks.faces.length === 6,
  'Riss-Overlay startet verborgen und deckt alle sechs Blockflächen ab');
ok(cracks.material.transparent && cracks.material.depthTest && !cracks.material.depthWrite,
  'Risse bleiben transparent und werden durch nähere Blöcke verdeckt');

cracks.update({ x: 4, y: 5, z: -2 }, 0.01);
ok(cracks.mesh.visible && cracks.stage === 0 && cracks.context.strokeCount > 0,
  'Erste schwarze Riss-Stufe erscheint beim Beginn des Abbaus');
ok(cracks.mesh.position.x === 4.5 && cracks.mesh.position.y === 5.5 && cracks.mesh.position.z === -1.5,
  'Risse sitzen auf dem aktuell abgebauten Block');

const earlyStrokeCount = cracks.context.strokeCount;
cracks.update({ x: 4, y: 5, z: -2 }, 0.68);
ok(cracks.stage === 6 && cracks.context.strokeCount > earlyStrokeCount,
  'Risse verzweigen sich sichtbar mit steigendem Abbaufortschritt');

cracks.update(null, 0.68);
ok(!cracks.mesh.visible, 'Risse verschwinden, wenn kein Block mehr abgebaut wird');
cracks.update({ x: 4, y: 5, z: -2 }, 0);
ok(!cracks.mesh.visible, 'Abbaufortschritt null zeigt keine Risse');

cracks.dispose();
ok(scene.children.length === 0, 'Riss-Overlay wird beim Aufräumen aus der Szene entfernt');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
