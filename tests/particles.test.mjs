// particles.test.mjs — Partikelqualität begrenzt sichtbare Effekte ohne GPU-Puffer-Neuaufbau.
import { ParticleSystem } from '../src/entities/particles.js';

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
const particles = new ParticleSystem(scene);
const spawnMany = (count) => {
  for (let i = 0; i < count; i++) particles.spawn(i, 0, 0, 1, 1, 1);
};

ok(scene.children.includes(particles.points) && particles.maxParticles === 800,
  'Partikelsystem startet mit großem Desktop-Budget und gemeinsamem Points-Mesh');
spawnMany(800);
ok(particles.count === 800 && particles.geometry.drawRange.count === 800,
  'Hohes Partikelbudget nutzt den vorhandenen Puffer bis zur Kapazität');
particles.setQuality('low');
ok(particles.maxParticles === 180 && particles.count === 180
  && particles.geometry.drawRange.count === 180,
  'Niedrige Qualität reduziert aktive Partikel sofort auf das mobile Budget');
spawnMany(500);
ok(particles.count === 180, 'Neue Partikel respektieren das niedrigere Qualitätslimit');
particles.setQuality('high');
spawnMany(620);
ok(particles.count === 800, 'Zurück auf hohe Qualität erweitert das Budget ohne Pufferwechsel');
particles.setQuality('unbekannt');
ok(particles.quality === 'high', 'Ungültige Qualitätswerte fallen sicher auf hohe Qualität zurück');
particles.clear();
ok(particles.count === 0 && particles.geometry.drawRange.count === 0,
  'Partikel lassen sich ohne Rest-Draw-Range leeren');

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
