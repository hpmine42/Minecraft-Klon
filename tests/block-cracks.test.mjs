// block-cracks.test.mjs — Minecraft-artige Pixel-Rissstufen folgen dem Abbaufortschritt.
const context = {
  fillStyle: '',
  pixels: [],
  clearRect() { this.pixels = []; },
  fillRect(x, y, width, height) {
    this.pixels.push({ x, y, width, height, color: this.fillStyle });
  },
};
let canvas;
globalThis.document = {
  createElement(name) {
    if (name !== 'canvas') throw new Error(`Unerwartetes DOM-Element: ${name}`);
    canvas = {
      width: 0,
      height: 0,
      getContext(type) { return type === '2d' ? context : null; },
    };
    return canvas;
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
ok(canvas.width === 16 && canvas.height === 16
  && cracks.geometry.parameters.width === 1 && cracks.geometry.parameters.height === 1,
  'Bruchtextur ist pixelig aufgelöst und deckt eine ganze Blockfläche ab');
ok(cracks.material.transparent && cracks.material.depthTest && !cracks.material.depthWrite
  && cracks.material.polygonOffset && cracks.texture.magFilter === cracks.texture.minFilter,
  'Pixelrisse liegen flächenbündig, bleiben transparent und werden tiefengeprüft');

cracks.update({ x: 4, y: 5, z: -2 }, 0.01);
ok(cracks.mesh.visible && cracks.stage === 0 && context.pixels.length > 0,
  'Erste pixelige Minecraft-Riss-Stufe erscheint beim Abbaubeginn');
ok(context.pixels.every((pixel) => pixel.width === 1 && pixel.height === 1)
  && context.pixels.some((pixel) => pixel.color.includes('24,24,24'))
  && context.pixels.some((pixel) => pixel.color.includes('92,92,92')),
'Risse bestehen aus scharf abgegrenzten dunklen und grauen Pixeln');
ok(cracks.mesh.position.x === 4.5 && cracks.mesh.position.y === 5.5 && cracks.mesh.position.z === -1.5,
  'Risse sitzen auf dem aktuell abgebauten Block');

const earlyPixelCount = context.pixels.length;
cracks.update({ x: 4, y: 5, z: -2 }, 0.68);
ok(cracks.stage === 6 && context.pixels.length > earlyPixelCount,
  'Rissmuster wird mit dem Fortschritt dichter und verzweigter');
cracks.update({ x: 4, y: 5, z: -2 }, 1);
ok(cracks.stage === 9, 'Abbauschluss zeigt die dichteste der zehn Rissstufen');

cracks.update(null, 0.68);
ok(!cracks.mesh.visible, 'Risse verschwinden, wenn kein Block mehr abgebaut wird');
cracks.update({ x: 4, y: 5, z: -2 }, 0);
ok(!cracks.mesh.visible, 'Abbaufortschritt null zeigt keine Risse');

cracks.dispose();
ok(scene.children.length === 0, 'Riss-Overlay wird beim Aufräumen aus der Szene entfernt');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
