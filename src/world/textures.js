// textures.js — Prozeduraler Textur-Atlas (Pixel-Art) per Canvas.
// Erzeugt alle Block- und Item-Texturen ohne externe Bilder.
// Atlas: 16x16 Kacheln à 16x16 px = 256x256 px.

import { mulberry32 } from './noise.js';

export const TILE_SIZE = 16;
export const ATLAS_COLS = 16;
export const ATLAS_SIZE = TILE_SIZE * ATLAS_COLS;

/** Zeichnet ein Pixel mit optionalem Rauschen pro Kachel. */
function makeTilePainter(tileIndex, seed) {
  const rand = mulberry32(seed + tileIndex * 7919);
  const data = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);
  return {
    /** Grundfarbe + Rauschvariation setzen. */
    fill(r, g, b, variance = 8) {
      for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
        const v = (rand() - 0.5) * 2 * variance;
        data[i * 4] = clamp255(r + v);
        data[i * 4 + 1] = clamp255(g + v);
        data[i * 4 + 2] = clamp255(b + v);
        data[i * 4 + 3] = 255;
      }
      return this;
    },
    /** Kachel vollständig transparent machen (für Pflanzen, Glas, Items). */
    clear() {
      data.fill(0);
      return this;
    },
    set(x, y, r, g, b, a = 255) {
      if (x < 0 || y < 0 || x >= TILE_SIZE || y >= TILE_SIZE) return;
      const i = (y * TILE_SIZE + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
      return this;
    },
    rect(x, y, w, h, r, g, b, a = 255) {
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, r, g, b, a);
      }
      return this;
    },
    /** Pseudo-Zufällige Punkte verstreuen. */
    speckle(count, r, g, b, alpha = 255) {
      for (let i = 0; i < count; i++) {
        this.set(Math.floor(rand() * TILE_SIZE), Math.floor(rand() * TILE_SIZE), r, g, b, alpha);
      }
      return this;
    },
    rand,
    data,
  };
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Baut den gesamten Atlas und gibt { canvas, textureData } zurück.
 * Wird sowohl im Browser (Canvas) als auch in Tests (ImageData-Array) genutzt.
 */
export function generateAtlasData(seed = 1337) {
  const pixels = new Uint8ClampedArray(ATLAS_SIZE * ATLAS_SIZE * 4);

  const drawTile = (index, painter) => {
    const tx = (index % ATLAS_COLS) * TILE_SIZE;
    const ty = Math.floor(index / ATLAS_COLS) * TILE_SIZE;
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const src = (y * TILE_SIZE + x) * 4;
        const dst = ((ty + y) * ATLAS_SIZE + (tx + x)) * 4;
        pixels[dst] = painter.data[src];
        pixels[dst + 1] = painter.data[src + 1];
        pixels[dst + 2] = painter.data[src + 2];
        pixels[dst + 3] = painter.data[src + 3];
      }
    }
  };

  const tile = (index) => {
    const p = makeTilePainter(index, seed);
    return p;
  };

  // ---- Natur ---------------------------------------------------------------
  // 0 Gras-Top
  {
    const p = tile(0);
    p.fill(96, 160, 66, 14);
    p.speckle(28, 116, 180, 84);
    p.speckle(18, 78, 138, 54);
    drawTile(0, p);
  }
  // 1 Gras-Seite (Erde mit Grasnarbe)
  {
    const p = tile(1);
    p.fill(134, 96, 67, 10);
    p.speckle(14, 112, 78, 54);
    for (let x = 0; x < 16; x++) {
      const h = 3 + Math.floor(p.rand() * 3);
      for (let y = 0; y < h; y++) {
        const v = (p.rand() - 0.5) * 16;
        p.set(x, y, 92 + v, 158 + v, 64 + v);
      }
    }
    drawTile(1, p);
  }
  // 2 Stein
  {
    const p = tile(2);
    p.fill(127, 127, 127, 10);
    p.speckle(22, 110, 110, 110);
    p.speckle(12, 145, 145, 145);
    drawTile(2, p);
  }
  // 3 Erde
  {
    const p = tile(3);
    p.fill(134, 96, 67, 10);
    p.speckle(20, 112, 78, 54);
    p.speckle(10, 152, 112, 80);
    drawTile(3, p);
  }
  // 4 Bruchstein
  {
    const p = tile(4);
    p.fill(105, 105, 105, 12);
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(p.rand() * 12);
      const y = Math.floor(p.rand() * 12);
      p.rect(x, y, 3 + Math.floor(p.rand() * 3), 3 + Math.floor(p.rand() * 3), 88 + p.rand() * 30, 88 + p.rand() * 30, 88 + p.rand() * 30);
    }
    drawTile(4, p);
  }
  // 5 Grundgestein
  {
    const p = tile(5);
    p.fill(70, 70, 70, 18);
    p.speckle(24, 40, 40, 40);
    p.speckle(14, 105, 105, 105);
    drawTile(5, p);
  }
  // 6 Sand
  {
    const p = tile(6);
    p.fill(219, 205, 158, 10);
    p.speckle(18, 200, 186, 138);
    p.speckle(12, 234, 222, 178);
    drawTile(6, p);
  }
  // 7 Kies
  {
    const p = tile(7);
    p.fill(127, 120, 114, 12);
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(p.rand() * 14);
      const y = Math.floor(p.rand() * 14);
      const c = 100 + p.rand() * 50;
      p.rect(x, y, 2, 2, c, c - 5, c - 8);
    }
    drawTile(7, p);
  }
  // 8 Sandstein Top
  {
    const p = tile(8);
    p.fill(216, 202, 155, 8);
    drawTile(8, p);
  }
  // 9 Sandstein Seite
  {
    const p = tile(9);
    p.fill(216, 202, 155, 8);
    for (let y = 2; y < 16; y += 5) p.rect(0, y, 16, 1, 196, 182, 135);
    drawTile(9, p);
  }
  // 10 Sandstein Bottom
  {
    const p = tile(10);
    p.fill(206, 192, 145, 8);
    drawTile(10, p);
  }
  // 11 Lehm
  {
    const p = tile(11);
    p.fill(160, 160, 170, 8);
    p.speckle(16, 145, 145, 155);
    drawTile(11, p);
  }
  // 12 Schnee Top
  {
    const p = tile(12);
    p.fill(242, 246, 252, 6);
    p.speckle(10, 228, 234, 244);
    drawTile(12, p);
  }
  // 13 Schnee Seite
  {
    const p = tile(13);
    p.fill(134, 96, 67, 10);
    for (let x = 0; x < 16; x++) {
      const h = 3 + Math.floor(p.rand() * 2);
      for (let y = 0; y < h; y++) p.set(x, y, 240, 244, 250);
    }
    drawTile(13, p);
  }
  // 14 Eis
  {
    const p = tile(14);
    p.fill(160, 196, 236, 8);
    p.speckle(14, 180, 212, 246);
    p.rect(4, 2, 1, 12, 190, 215, 245);
    p.rect(10, 4, 1, 10, 190, 215, 245);
    drawTile(14, p);
  }
  // 15 Obsidian
  {
    const p = tile(15);
    p.fill(28, 20, 40, 10);
    p.speckle(20, 50, 35, 80);
    p.speckle(10, 15, 10, 28);
    drawTile(15, p);
  }
  // 16 Wasser (auch als eigenständige Textur animiert)
  {
    const p = tile(16);
    p.fill(52, 108, 202, 10);
    p.speckle(20, 70, 130, 220);
    p.rect(2, 3, 6, 1, 90, 150, 225);
    p.rect(8, 9, 5, 1, 90, 150, 225);
    drawTile(16, p);
  }
  // 17 Lava
  {
    const p = tile(17);
    p.fill(206, 92, 20, 16);
    p.speckle(22, 240, 160, 40);
    p.speckle(16, 150, 40, 10);
    p.rect(3, 5, 8, 2, 250, 190, 60);
    drawTile(17, p);
  }
  // ---- Erze (Stein-Basis + Farbtupfer) ------------------------------------
  const oreTile = (index, r, g, b) => {
    const p = tile(index);
    p.fill(127, 127, 127, 10);
    for (let i = 0; i < 5; i++) {
      const x = 1 + Math.floor(p.rand() * 12);
      const y = 1 + Math.floor(p.rand() * 12);
      p.rect(x, y, 2 + Math.floor(p.rand() * 2), 2 + Math.floor(p.rand() * 2), r, g, b);
      p.set(x + 1, y + 1, clamp255(r * 1.25), clamp255(g * 1.25), clamp255(b * 1.25));
    }
    drawTile(index, p);
  };
  oreTile(18, 28, 28, 30);      // Kohle
  oreTile(19, 216, 175, 147);   // Eisen
  oreTile(20, 250, 220, 80);    // Gold
  oreTile(21, 95, 220, 215);    // Diamant
  oreTile(22, 220, 40, 40);     // Redstone

  // ---- Holz ---------------------------------------------------------------
  // 23 Stamm-Seite (Eiche)
  {
    const p = tile(23);
    p.fill(104, 82, 50, 8);
    for (let x = 0; x < 16; x += 3) {
      const c = 88 + p.rand() * 24;
      p.rect(x, 0, 1, 16, c, c * 0.78, c * 0.5);
    }
    drawTile(23, p);
  }
  // 24 Stamm-Top (Jahresringe)
  {
    const p = tile(24);
    p.fill(160, 130, 82, 8);
    for (let r = 6; r > 0; r -= 2) {
      for (let a = 0; a < 64; a++) {
        const x = Math.round(8 + Math.cos((a / 64) * Math.PI * 2) * r);
        const y = Math.round(8 + Math.sin((a / 64) * Math.PI * 2) * r);
        p.set(x, y, 130, 104, 62);
      }
    }
    drawTile(24, p);
  }
  // 25 Eichenlaub (undurchsichtig wie Minecraft "schnelle Grafik")
  {
    const p = tile(25);
    p.fill(56, 122, 46, 16);
    p.speckle(30, 40, 96, 34);
    p.speckle(18, 84, 152, 62);
    drawTile(25, p);
  }
  // 26 Birkenstamm-Seite
  {
    const p = tile(26);
    p.fill(222, 222, 216, 8);
    for (let y = 1; y < 16; y += 3) {
      const w = 3 + Math.floor(p.rand() * 5);
      p.rect(Math.floor(p.rand() * 12), y, w, 1, 40, 36, 32);
    }
    drawTile(26, p);
  }
  // 27 Birkenstamm-Top
  {
    const p = tile(27);
    p.fill(206, 194, 160, 8);
    drawTile(27, p);
  }
  // 28 Birkenlaub
  {
    const p = tile(28);
    p.fill(84, 142, 58, 16);
    p.speckle(26, 62, 116, 44);
    p.speckle(16, 106, 166, 76);
    drawTile(28, p);
  }
  // 29 Fichtenstamm-Seite
  {
    const p = tile(29);
    p.fill(74, 52, 32, 8);
    for (let x = 0; x < 16; x += 3) p.rect(x, 0, 1, 16, 58, 40, 24);
    drawTile(29, p);
  }
  // 30 Fichtenstamm-Top
  {
    const p = tile(30);
    p.fill(120, 92, 56, 8);
    drawTile(30, p);
  }
  // 31 Fichtenlaub
  {
    const p = tile(31);
    p.fill(40, 88, 50, 16);
    p.speckle(28, 28, 66, 38);
    p.speckle(14, 60, 114, 64);
    drawTile(31, p);
  }
  // 32 Bretter
  {
    const p = tile(32);
    p.fill(178, 143, 88, 8);
    for (let y = 0; y < 16; y += 4) {
      p.rect(0, y, 16, 1, 148, 116, 68);
      p.rect(Math.floor(p.rand() * 10), y + 1, 1, 3, 150, 118, 70);
    }
    drawTile(32, p);
  }
  // 33 Setzling
  {
    const p = tile(33);
    p.clear();
    p.rect(7, 8, 2, 7, 110, 82, 48);
    p.rect(4, 5, 3, 2, 62, 130, 52);
    p.rect(9, 4, 3, 2, 72, 148, 62);
    p.rect(5, 8, 2, 2, 58, 120, 48);
    p.rect(9, 7, 2, 2, 80, 158, 70);
    drawTile(33, p);
  }
  // 34 Bücherregal-Seite
  {
    const p = tile(34);
    p.fill(178, 143, 88, 6);
    const colors = [[180, 60, 50], [70, 110, 170], [200, 180, 70], [90, 150, 80], [150, 80, 150]];
    for (let row = 0; row < 2; row++) {
      for (let x = 1; x < 15; x += 3) {
        const c = colors[Math.floor(p.rand() * colors.length)];
        p.rect(x, 2 + row * 7, 2, 5, c[0], c[1], c[2]);
      }
      p.rect(0, 7 + row * 7 - 1, 16, 1, 148, 116, 68);
    }
    drawTile(34, p);
  }
  // 35 Roter Mohn
  {
    const p = tile(35);
    p.clear();
    p.rect(7, 8, 2, 7, 52, 120, 44);
    p.rect(5, 3, 6, 5, 210, 48, 42);
    p.set(7, 5, 240, 90, 80); p.set(8, 4, 240, 90, 80);
    p.rect(6, 2, 4, 1, 220, 60, 52);
    drawTile(35, p);
  }
  // 36 Gelbe Blume
  {
    const p = tile(36);
    p.clear();
    p.rect(7, 8, 2, 7, 52, 120, 44);
    p.rect(5, 3, 6, 5, 230, 210, 60);
    p.set(7, 5, 200, 160, 40);
    drawTile(36, p);
  }
  // 37 Hohes Gras
  {
    const p = tile(37);
    p.clear();
    for (let x = 2; x < 15; x += 2) {
      const h = 6 + Math.floor(p.rand() * 8);
      const c = 60 + p.rand() * 40;
      for (let y = 16 - h; y < 16; y++) p.set(x + (y % 3 === 0 ? 1 : 0), y, c * 0.85, c * 1.7, c * 0.55);
    }
    drawTile(37, p);
  }
  // 38 Roter Pilz
  {
    const p = tile(38);
    p.clear();
    p.rect(7, 8, 2, 6, 230, 226, 210);
    p.rect(4, 5, 8, 4, 200, 52, 46);
    p.set(6, 6, 240, 240, 236); p.set(10, 6, 240, 240, 236);
    drawTile(38, p);
  }
  // 39 (Platzhalter – alte Weizenstufe)
  {
    const p = tile(39);
    p.clear();
    drawTile(39, p);
  }
  // 40/41 Kaktus
  {
    const p = tile(40);
    p.fill(58, 128, 52, 10);
    for (let y = 0; y < 16; y += 3) {
      p.set(2 + (y % 6 === 0 ? 1 : 0), y, 30, 90, 36);
      p.set(12, y + 1, 30, 90, 36);
    }
    p.rect(0, 0, 1, 16, 40, 96, 40);
    p.rect(15, 0, 1, 16, 40, 96, 40);
    drawTile(40, p);
    const q = tile(41);
    q.fill(72, 142, 62, 10);
    q.rect(3, 3, 10, 10, 60, 126, 52);
    drawTile(41, q);
  }
  // 42 Zuckerrohr
  {
    const p = tile(42);
    p.clear();
    for (let x = 5; x < 11; x++) {
      for (let y = 0; y < 16; y++) {
        const v = y % 5 === 0 ? 20 : 0;
        p.set(x, y, 128 + v, 190 + v, 92 + v);
      }
    }
    drawTile(42, p);
  }
  // 43 Glas
  {
    const p = tile(43);
    p.clear();
    for (let i = 0; i < 16; i++) {
      p.set(i, 0, 235, 245, 250); p.set(i, 15, 235, 245, 250);
      p.set(0, i, 235, 245, 250); p.set(15, i, 235, 245, 250);
    }
    p.rect(3, 3, 4, 1, 255, 255, 255, 180);
    p.rect(3, 4, 1, 3, 255, 255, 255, 180);
    drawTile(43, p);
  }
  // 44 Wolle
  {
    const p = tile(44);
    p.fill(232, 232, 232, 8);
    p.speckle(16, 214, 214, 214);
    drawTile(44, p);
  }
  // 45 Ziegelsteine
  {
    const p = tile(45);
    p.fill(156, 82, 68, 8);
    for (let y = 0; y < 16; y += 4) {
      p.rect(0, y, 16, 1, 190, 190, 190);
      const off = (y / 4) % 2 === 0 ? 3 : 11;
      p.rect(off, y, 1, 4, 190, 190, 190);
      p.rect(off + 8 > 15 ? off - 8 : off + 8, y, 1, 4, 190, 190, 190);
    }
    drawTile(45, p);
  }
  // 46 Steinziegel
  {
    const p = tile(46);
    p.fill(122, 122, 122, 8);
    p.rect(0, 7, 16, 1, 96, 96, 96);
    p.rect(7, 0, 1, 7, 96, 96, 96);
    p.rect(3, 8, 1, 8, 96, 96, 96);
    p.rect(11, 8, 1, 8, 96, 96, 96);
    drawTile(46, p);
  }
  // 47 Moosiges Bruchstein
  {
    const p = tile(4);
    p.fill(105, 105, 105, 12);
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(p.rand() * 12);
      const y = Math.floor(p.rand() * 12);
      p.rect(x, y, 3, 3, 88 + p.rand() * 20, 88 + p.rand() * 20, 88 + p.rand() * 20);
    }
    p.speckle(26, 84, 130, 70);
    drawTile(47, p);
  }
  // 48 Ackerboden Top (feucht)
  {
    const p = tile(48);
    p.fill(92, 62, 40, 8);
    for (let y = 1; y < 16; y += 3) p.rect(0, y, 16, 1, 70, 46, 28);
    drawTile(48, p);
  }
  // 49 Ackerboden Seite
  {
    const p = tile(49);
    p.fill(134, 96, 67, 10);
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 2; y++) {
        const v = (p.rand() - 0.5) * 16;
        p.set(x, y, 92 + v, 158 + v, 64 + v);
      }
    }
    p.rect(0, 2, 16, 2, 100, 70, 46);
    drawTile(49, p);
  }
  // 50 Leiter
  {
    const p = tile(50);
    p.clear();
    p.rect(2, 0, 2, 16, 150, 118, 70);
    p.rect(12, 0, 2, 16, 150, 118, 70);
    for (let y = 2; y < 16; y += 4) p.rect(2, y, 12, 1, 170, 138, 84);
    drawTile(50, p);
  }
  // 51 Fackel
  {
    const p = tile(51);
    p.clear();
    p.rect(7, 6, 2, 10, 150, 112, 62);
    p.rect(6, 3, 4, 4, 250, 190, 60);
    p.set(7, 2, 255, 240, 140); p.set(8, 2, 255, 240, 140);
    p.set(7, 4, 255, 120, 30); p.set(8, 5, 255, 120, 30);
    drawTile(51, p);
  }
  // 52 Werkbank-Seite
  {
    const p = tile(52);
    p.fill(178, 143, 88, 8);
    p.rect(0, 0, 16, 4, 150, 116, 68);
    p.rect(1, 1, 6, 2, 110, 82, 48);
    p.rect(9, 1, 6, 2, 110, 82, 48);
    p.rect(1, 5, 14, 1, 120, 90, 54);
    drawTile(52, p);
  }
  // 53 Ofen Top/Seite
  {
    const p = tile(53);
    p.fill(110, 110, 110, 10);
    p.speckle(18, 95, 95, 95);
    drawTile(53, p);
  }
  // 54 Ofen Front
  {
    const p = tile(54);
    p.fill(110, 110, 110, 10);
    p.rect(3, 6, 10, 8, 40, 40, 40);
    p.rect(5, 9, 6, 4, 220, 120, 40);
    p.set(6, 10, 250, 180, 70); p.set(8, 11, 250, 180, 70);
    drawTile(54, p);
  }
  // 55/56 Truhe
  {
    const p = tile(55);
    p.fill(160, 116, 62, 8);
    p.rect(0, 0, 16, 2, 120, 86, 42);
    drawTile(55, p);
    const q = tile(56);
    q.fill(160, 116, 62, 8);
    q.rect(0, 6, 16, 1, 90, 64, 32);
    q.rect(7, 5, 2, 4, 210, 200, 170);
    drawTile(56, q);
  }
  // ---- Items (16x16 Icons) -------------------------------------------------
  const itemIcon = (index, fn) => {
    const p = tile(index);
    p.clear();
    fn(p);
    drawTile(index, p);
  };
  itemIcon(57, (p) => { // Stock
    for (let i = 0; i < 9; i++) {
      p.set(4 + i, 11 - i, 150, 112, 62);
      p.set(5 + i, 11 - i, 120, 88, 48);
    }
  });
  itemIcon(58, (p) => { // Kohle
    p.rect(5, 5, 6, 6, 30, 30, 32);
    p.rect(6, 4, 4, 1, 30, 30, 32);
    p.set(7, 6, 70, 70, 74); p.set(9, 8, 70, 70, 74);
    p.rect(4, 7, 1, 2, 30, 30, 32); p.rect(11, 6, 1, 3, 30, 30, 32);
  });
  itemIcon(59, (p) => { // Eisenbarren
    p.rect(3, 8, 10, 4, 216, 216, 220);
    p.rect(4, 6, 8, 2, 235, 235, 238);
    p.rect(5, 7, 3, 1, 255, 255, 255);
  });
  itemIcon(60, (p) => { // Goldbarren
    p.rect(3, 8, 10, 4, 240, 200, 60);
    p.rect(4, 6, 8, 2, 250, 220, 90);
    p.rect(5, 7, 3, 1, 255, 245, 160);
  });
  itemIcon(61, (p) => { // Diamant
    p.rect(5, 4, 6, 2, 100, 230, 225);
    p.rect(4, 6, 8, 3, 80, 210, 210);
    p.rect(5, 9, 6, 2, 60, 180, 190);
    p.rect(6, 11, 4, 1, 40, 150, 165);
    p.set(6, 5, 220, 255, 255); p.set(7, 7, 220, 255, 255);
  });
  itemIcon(62, (p) => { // Redstone
    p.rect(6, 5, 3, 3, 200, 30, 30);
    p.rect(4, 8, 3, 3, 170, 20, 20);
    p.rect(8, 9, 3, 2, 230, 50, 50);
    p.set(7, 6, 255, 120, 120);
  });
  itemIcon(63, (p) => { // Samen
    p.set(5, 6, 90, 150, 60); p.set(6, 7, 90, 150, 60);
    p.set(9, 5, 110, 170, 70); p.set(10, 6, 110, 170, 70);
    p.set(6, 10, 80, 130, 50); p.set(9, 10, 80, 130, 50);
  });
  itemIcon(64, (p) => { // Weizen-Item
    for (let i = 0; i < 8; i++) {
      p.set(7, 13 - i, 200, 180, 80);
      p.set(6, 12 - i, 220, 200, 100);
      p.set(8, 12 - i, 220, 200, 100);
    }
  });
  itemIcon(65, (p) => { // Leder
    p.rect(4, 5, 8, 6, 180, 110, 60);
    p.rect(5, 4, 6, 1, 180, 110, 60);
    p.rect(5, 11, 6, 1, 150, 90, 50);
    p.set(6, 7, 150, 90, 50); p.set(9, 8, 150, 90, 50);
  });
  itemIcon(66, (p) => { // Feder
    for (let i = 0; i < 10; i++) {
      p.set(5 + i, 12 - i, 240, 240, 245);
      p.set(6 + i, 12 - i, 220, 220, 228);
      if (i < 6) p.set(5 + i, 11 - i, 225, 225, 232);
    }
    p.set(4, 13, 120, 120, 130);
  });
  itemIcon(67, (p) => { // Knochen
    p.rect(4, 7, 8, 2, 235, 232, 220);
    p.rect(3, 6, 2, 2, 235, 232, 220); p.rect(3, 9, 2, 2, 235, 232, 220);
    p.rect(11, 6, 2, 2, 235, 232, 220); p.rect(11, 9, 2, 2, 235, 232, 220);
  });
  itemIcon(68, (p) => { // Knochenmehl
    p.rect(5, 5, 6, 8, 235, 235, 230);
    p.rect(6, 4, 4, 1, 235, 235, 230);
    p.speckle(10, 200, 200, 195);
  });
  itemIcon(69, (p) => { // Apfel
    p.rect(5, 6, 6, 6, 210, 40, 40);
    p.rect(4, 7, 1, 4, 210, 40, 40); p.rect(11, 7, 1, 4, 210, 40, 40);
    p.rect(7, 4, 1, 2, 100, 70, 40);
    p.set(6, 7, 240, 90, 90); p.set(7, 7, 240, 90, 90);
  });
  itemIcon(70, (p) => { // Brot
    p.rect(3, 6, 10, 5, 190, 130, 70);
    p.rect(4, 5, 8, 1, 210, 150, 85);
    p.rect(5, 7, 2, 1, 150, 100, 55); p.rect(9, 8, 2, 1, 150, 100, 55);
  });
  const meatIcon = (index, r, g, b, cooked) => {
    itemIcon(index, (p) => {
      p.rect(4, 5, 8, 7, r, g, b);
      p.rect(5, 4, 6, 1, r, g, b);
      p.rect(3, 7, 1, 3, r, g, b);
      if (cooked) {
        p.rect(6, 7, 4, 1, clamp255(r * 0.75), clamp255(g * 0.7), clamp255(b * 0.7));
        p.rect(7, 9, 3, 1, clamp255(r * 0.75), clamp255(g * 0.7), clamp255(b * 0.7));
      } else {
        p.set(6, 6, clamp255(r * 1.2), clamp255(g * 1.15), clamp255(b * 1.1));
        p.rect(6, 8, 3, 2, clamp255(r * 1.12), clamp255(g * 1.1), clamp255(b * 1.05));
      }
    });
  };
  meatIcon(71, 235, 140, 145, false);  // Rohes Schwein
  meatIcon(72, 200, 130, 95, true);    // Gebratenes Schwein
  meatIcon(73, 220, 90, 85, false);    // Rohes Rind
  meatIcon(74, 160, 85, 60, true);     // Steak
  meatIcon(75, 235, 175, 150, false);  // Rohes Huhn
  meatIcon(76, 200, 150, 110, true);   // Gebratenes Huhn

  // Werkzeug-Icons
  const toolIcon = (index, headR, headG, headB, stickDark) => {
    itemIcon(index, (p) => {
      for (let i = 0; i < 8; i++) {
        p.set(4 + i, 12 - i, stickDark ? 110 : 150, stickDark ? 82 : 112, 48);
        p.set(5 + i, 12 - i, stickDark ? 90 : 120, stickDark ? 64 : 88, 40);
      }
      return p;
    });
  };
  const pickIcon = (index, r, g, b, dk) => {
    itemIcon(index, (p) => {
      for (let i = 0; i < 8; i++) {
        p.set(5 + i, 12 - i, dk ? 110 : 150, dk ? 82 : 112, 48);
      }
      p.rect(3, 3, 2, 2, r, g, b); p.rect(5, 2, 6, 2, r, g, b); p.rect(11, 3, 2, 2, r, g, b);
      p.set(6, 3, clamp255(r * 1.2), clamp255(g * 1.2), clamp255(b * 1.2));
    });
  };
  const axeIcon = (index, r, g, b, dk) => {
    itemIcon(index, (p) => {
      for (let i = 0; i < 9; i++) {
        p.set(4 + i, 13 - i, dk ? 110 : 150, dk ? 82 : 112, 48);
      }
      p.rect(6, 2, 5, 5, r, g, b);
      p.rect(5, 3, 1, 3, r, g, b);
      p.set(7, 3, clamp255(r * 1.2), clamp255(g * 1.2), clamp255(b * 1.2));
    });
  };
  const shovelIcon = (index, r, g, b, dk) => {
    itemIcon(index, (p) => {
      for (let i = 0; i < 9; i++) {
        p.set(4 + i, 13 - i, dk ? 110 : 150, dk ? 82 : 112, 48);
      }
      p.rect(10, 2, 3, 4, r, g, b);
      p.set(11, 3, clamp255(r * 1.2), clamp255(g * 1.2), clamp255(b * 1.2));
    });
  };
  const swordIcon = (index, r, g, b, dk) => {
    itemIcon(index, (p) => {
      for (let i = 0; i < 6; i++) {
        p.set(4 + i, 12 - i, dk ? 110 : 150, dk ? 82 : 112, 48);
      }
      p.rect(3, 10, 3, 2, dk ? 110 : 150, dk ? 82 : 112, 48);
      for (let i = 0; i < 8; i++) {
        p.set(6 + i, 9 - i, r, g, b);
        p.set(7 + i, 9 - i, clamp255(r * 1.15), clamp255(g * 1.15), clamp255(b * 1.15));
      }
    });
  };
  const matColors = {
    wood: [170, 130, 75], stone: [130, 130, 130], iron: [216, 216, 220], diamond: [90, 220, 215],
  };
  pickIcon(77, ...matColors.wood, false); pickIcon(78, ...matColors.stone, true);
  pickIcon(79, ...matColors.iron, true); pickIcon(80, ...matColors.diamond, true);
  axeIcon(81, ...matColors.wood, false); axeIcon(82, ...matColors.stone, true);
  axeIcon(83, ...matColors.iron, true); axeIcon(84, ...matColors.diamond, true);
  shovelIcon(85, ...matColors.wood, false); shovelIcon(86, ...matColors.stone, true);
  shovelIcon(87, ...matColors.iron, true); shovelIcon(88, ...matColors.diamond, true);
  swordIcon(89, ...matColors.wood, false); swordIcon(90, ...matColors.stone, true);
  swordIcon(91, ...matColors.iron, true); swordIcon(92, ...matColors.diamond, true);
  // Hacken (97-100)
  const hoeIcon = (index, r, g, b, dk) => {
    itemIcon(index, (p) => {
      for (let i = 0; i < 9; i++) {
        p.set(4 + i, 13 - i, dk ? 110 : 150, dk ? 82 : 112, 48);
      }
      p.rect(8, 2, 6, 2, r, g, b);
      p.rect(7, 3, 1, 2, r, g, b);
      p.set(10, 3, clamp255(r * 1.2), clamp255(g * 1.2), clamp255(b * 1.2));
    });
  };
  hoeIcon(97, ...matColors.wood, false); hoeIcon(98, ...matColors.stone, true);
  hoeIcon(99, ...matColors.iron, true); hoeIcon(100, ...matColors.diamond, true);

  // 93-96 Weizen-Wachstumsstufen
  {
    const stages = [
      { h: 4, c: [120, 170, 70] },
      { h: 7, c: [150, 180, 70] },
      { h: 11, c: [190, 190, 80] },
      { h: 15, c: [215, 195, 95] },
    ];
    stages.forEach((st, si) => {
      const p = tile(93 + si);
      p.clear();
      for (let x = 2; x < 15; x += 3) {
        for (let y = 16 - st.h; y < 16; y++) {
          const t = (y / 16) * 0.3;
          p.set(x, y, st.c[0] * (1 - t), st.c[1] * (1 - t), st.c[2] * (1 - t));
          if (si === 3 && y % 4 === 0) p.set(x + 1, y, 230, 210, 110);
        }
      }
      drawTile(93 + si, p);
    });
  }

  return { pixels, size: ATLAS_SIZE };
}

/** Erzeugt das Atlas-Canvas (nur Browser). */
export function createAtlasCanvas(seed = 1337) {
  const { pixels, size } = generateAtlasData(seed);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  img.data.set(pixels);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Zeichnet ein Item-/Block-Icon in ein Ziel-Canvas (für HUD/Inventar). */
export function drawTileIcon(targetCanvas, tileIndex, atlasCanvas) {
  const ctx = targetCanvas.getContext('2d');
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.imageSmoothingEnabled = false;
  const sx = (tileIndex % ATLAS_COLS) * TILE_SIZE;
  const sy = Math.floor(tileIndex / ATLAS_COLS) * TILE_SIZE;
  ctx.drawImage(atlasCanvas, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, targetCanvas.width, targetCanvas.height);
}

/** Eigenständige Wasser-Textur (animierbarer 4-Frame-Streifen). */
export function createWaterTexture() {
  const frames = 4;
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE * frames;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  for (let f = 0; f < frames; f++) {
    const p = makeTilePainter(200 + f, 4242);
    p.fill(52, 108, 202, 10);
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(p.rand() * 14);
      const y = Math.floor(p.rand() * 14);
      p.rect(x, y, 2 + Math.floor(p.rand() * 3), 1, 86, 142, 222);
    }
    const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    img.data.set(p.data);
    ctx.putImageData(img, f * TILE_SIZE, 0);
  }
  return canvas;
}

export function createLavaTexture() {
  const frames = 4;
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE * frames;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  for (let f = 0; f < frames; f++) {
    const p = makeTilePainter(210 + f, 999);
    p.fill(206, 92, 20, 16);
    p.speckle(20, 240, 160, 40);
    p.speckle(14, 150, 40, 10);
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(p.rand() * 12);
      const y = Math.floor(p.rand() * 12);
      p.rect(x, y, 4, 2, 250, 190, 60);
    }
    const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    img.data.set(p.data);
    ctx.putImageData(img, f * TILE_SIZE, 0);
  }
  return canvas;
}
