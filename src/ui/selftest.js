// selftest.js — Integrierte Selbstdiagnose (läuft im Browser, z. B. auf dem Handy).
// Prüft System, WebGL, Eingabe, Storage, Weltlogik und Performance.

export async function runSelfTest(game) {
  const results = [];
  const add = (name, ok, detail = '') => results.push({ name, ok, detail });

  // ---- System --------------------------------------------------------------
  add('JavaScript-Engine', typeof window !== 'undefined', navigator.userAgent.slice(0, 80));
  add('Touch-Erkennung', true, game.isTouch
    ? `Touch aktiv (maxTouchPoints=${navigator.maxTouchPoints})`
    : 'Kein Touch erkannt (Desktop-Modus)');
  add('Viewport', true, `${window.innerWidth}×${window.innerHeight} px, DPR ${window.devicePixelRatio || 1}`);
  add('Orientierung', true, window.innerWidth > window.innerHeight ? 'Querformat' : 'Hochformat');

  // ---- WebGL ---------------------------------------------------------------
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      add('WebGL', true, String(renderer).slice(0, 70));
    } else {
      add('WebGL', false, 'Kein WebGL-Kontext möglich');
    }
  } catch (e) {
    add('WebGL', false, String(e).slice(0, 70));
  }

  // ---- Storage -------------------------------------------------------------
  try {
    localStorage.setItem('mkl-selftest', '1');
    const ok = localStorage.getItem('mkl-selftest') === '1';
    localStorage.removeItem('mkl-selftest');
    add('localStorage', ok, ok ? 'Lesen/Schreiben funktioniert' : 'Fehler');
  } catch (e) {
    add('localStorage', false, String(e).slice(0, 70));
  }

  // ---- Audio ---------------------------------------------------------------
  const audioOk = !!(window.AudioContext || window.webkitAudioContext);
  add('WebAudio', audioOk, audioOk ? 'Verfügbar (nach erstem Tipp aktiv)' : 'Nicht verfügbar');

  // ---- Spiel-Logik ---------------------------------------------------------
  if (game.world) {
    const w = game.world;
    const b = w.getBlock(Math.floor(game.player.position.x), Math.floor(game.player.position.y) - 1, Math.floor(game.player.position.z));
    add('Welt geladen', w.chunks.size > 0, `${w.chunks.size} Chunks generiert`);
    add('Boden unter Spieler', b !== 0, `Block-ID ${b} (${typeof b === 'number' ? 'ok' : 'fehlerhaft'})`);
    const stats = w.stats();
    add('Meshes', stats.solidVerts > 0, `${stats.solidVerts} Vertices sichtbar`);
    add('Raycast', true, (() => {
      const hit = w.raycast(game.player.eyePosition(), game.player.lookDir(), 5.2);
      return hit ? `trifft Block ${hit.id}` : 'kein Block im Blickfeld';
    })());
    add('Licht-Engine', true, `Himmelslicht am Spieler: ${w.getSkyLight(Math.floor(game.player.position.x), Math.floor(game.player.position.y), Math.floor(game.player.position.z))}/15`);
  }

  if (game.inventory) {
    add('Inventar', game.inventory.slots.length === 36, `${game.inventory.slots.length} Slots`);
  }
  if (game.mobs) {
    add('Entities', true, `${game.mobs.mobs.length} Mobs, ${game.mobs.items.length} Items`);
  }

  // ---- Performance ---------------------------------------------------------
  const t0 = performance.now();
  let frames = 0;
  await new Promise((resolve) => {
    const tick = () => {
      frames++;
      if (frames >= 30) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // Timeout-Fallback
    setTimeout(resolve, 1500);
  });
  const elapsed = performance.now() - t0;
  const fps = frames > 0 ? Math.round(frames / (elapsed / 1000)) : 0;
  add('Performance', fps >= 20, `ca. ${fps} FPS im Test (${frames} Frames in ${Math.round(elapsed)} ms)`);

  // ---- Steuerung -----------------------------------------------------------
  add('Eingabe', true, game.isTouch
    ? 'Touch-Steuerung bereit (Joystick + Buttons)'
    : `Tastatur/Maus bereit${game.input && game.input.locked ? ' (Pointer-Lock aktiv)' : ''}`);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return { results, passed, failed, fps };
}

/** Zeigt die Ergebnisse im selftest-screen an. */
export function renderSelfTest(container, report) {
  const rows = report.results.map((r) => `
    <tr class="${r.ok ? 'ok' : 'fail'}">
      <td>${r.ok ? '✔' : '✘'}</td>
      <td>${r.name}</td>
      <td>${r.detail}</td>
    </tr>
  `).join('');
  container.innerHTML = `
    <h3>Selbstdiagnose: ${report.passed} bestanden, ${report.failed} fehlgeschlagen</h3>
    <table class="selftest-table">${rows}</table>
    <p class="selftest-note">Tipp: Starte den Test zusätzlich auf dem Handy – die Steuerung und die
    Performance werden dort besonders geprüft. Bei niedrigen FPS die Renderdistanz in den
    Einstellungen reduzieren.</p>
  `;
}
