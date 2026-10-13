// hud.js — HUD: Hotbar, Herzen, Hunger, Luftblasen, Zielblock-Fortschritt, FPS.
import { BLOCKS, BLOCK, getName } from '../world/blocks.js';
import { drawTileIcon } from '../world/textures.js';
import { markTouchEvent, wasRecentTouch } from '../core/touch.js';

export class HUD {
  constructor(elements, atlasCanvas, inventory) {
    this.els = elements;
    this.atlas = atlasCanvas;
    this.inventory = inventory;
    this.lastSelected = -1;
    this.lastCounts = [];
    this.nameToastTimer = 0;
    this.gameplayActive = false;
    this.heldItemSignature = null;
    this.fpsHistory = [];
    this.fps = 0;

    this._buildHotbar();
    this._buildStats();
  }

  _buildHotbar() {
    const bar = this.els.hotbar;
    bar.innerHTML = '';
    this.slotEls = [];
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.dataset.index = String(i);
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      canvas.className = 'item-icon';
      const count = document.createElement('span');
      count.className = 'item-count';
      const dur = document.createElement('div');
      dur.className = 'durability-bar';
      dur.innerHTML = '<div></div>';
      slot.appendChild(canvas);
      slot.appendChild(count);
      slot.appendChild(dur);
      bar.appendChild(slot);
      this.slotEls.push({ slot, canvas, count, dur, durFill: dur.firstChild });

      // Klick/Touch → Hotbar wählen (nur wenn HUD aktiv)
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        markTouchEvent();
        this.inventory.selected = i;
        this.onSelect && this.onSelect(i);
        this.update(true);
      };
      slot.addEventListener('touchstart', handler, { passive: false });
      slot.addEventListener('mousedown', (e) => {
        if (wasRecentTouch()) return;
        handler(e);
      });
    }
  }

  _buildStats() {
    const hearts = this.els.hearts;
    const hunger = this.els.hunger;
    const air = this.els.air;
    hearts.innerHTML = '';
    hunger.innerHTML = '';
    air.innerHTML = '';
    this.heartEls = [];
    this.hungerEls = [];
    this.airEls = [];
    for (let i = 0; i < 10; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.textContent = '❤';
      hearts.appendChild(h);
      this.heartEls.push(h);
    }
    for (let i = 0; i < 10; i++) {
      const f = document.createElement('span');
      f.className = 'hunger-icon';
      f.textContent = '🍖';
      hunger.appendChild(f);
      this.hungerEls.push(f);
    }
    for (let i = 0; i < 10; i++) {
      const b = document.createElement('span');
      b.className = 'bubble';
      b.textContent = '○';
      air.appendChild(b);
      this.airEls.push(b);
    }
  }

  /** Item-Name kurz anzeigen. */
  showItemName(name) {
    const el = this.els.itemName;
    el.textContent = name;
    el.classList.add('visible');
    this.nameToastTimer = 2.2;
  }

  setGameplayActive(active) {
    this.gameplayActive = !!active;
    this._refreshHeldItem();
  }

  _refreshHeldItem() {
    const view = this.els.heldItemView;
    const canvas = this.els.heldItemIcon;
    if (!view || !canvas) return;
    const stack = this.inventory.held();
    const visible = this.gameplayActive && !!stack;
    view.style.display = visible ? 'block' : 'none';
    if (!visible) return;

    const signature = `${stack.id}:${stack.count}:${stack.dur ?? ''}`;
    if (signature === this.heldItemSignature) return;
    this.heldItemSignature = signature;
    const def = BLOCKS[stack.id];
    if (def?.tiles?.length) {
      drawTileIcon(canvas, def.tiles[0], this.atlas);
      canvas.style.visibility = 'visible';
    } else {
      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.visibility = 'hidden';
    }
  }

  update(dt, player, gameplayActive = this.gameplayActive) {
    this.gameplayActive = !!gameplayActive;
    this._refreshHeldItem();
    // Name-Toast ausblenden
    if (this.nameToastTimer > 0) {
      this.nameToastTimer -= dt;
      if (this.nameToastTimer <= 0) this.els.itemName.classList.remove('visible');
    }

    // Hotbar neu zeichnen (nur bei Änderung)
    const sel = this.inventory.selected;
    const sig = this.inventory.slots.map((s) => (s ? `${s.id}:${s.count}:${s.dur ?? -1}` : '')).join('|');
    if (sig !== this._lastSig || sel !== this.lastSelected) {
      this._lastSig = sig;
      this.lastSelected = sel;
      for (let i = 0; i < 9; i++) {
        const { slot, canvas, count, dur, durFill } = this.slotEls[i];
        const s = this.inventory.slots[i];
        slot.classList.toggle('selected', i === sel);
        if (s) {
          const def = BLOCKS[s.id];
          const tile = def && def.tiles ? def.tiles[0] : 0;
          drawTileIcon(canvas, tile, this.atlas);
          canvas.style.visibility = 'visible';
          count.textContent = s.count > 1 ? String(s.count) : '';
          if (def && def.durability && s.dur != null) {
            const frac = s.dur / def.durability;
            dur.style.visibility = 'visible';
            durFill.style.width = `${Math.max(0, frac * 100)}%`;
            durFill.style.background = frac > 0.5 ? '#4caf50' : frac > 0.25 ? '#ffc107' : '#f44336';
          } else {
            dur.style.visibility = 'hidden';
          }
        } else {
          canvas.style.visibility = 'hidden';
          count.textContent = '';
          dur.style.visibility = 'hidden';
        }
      }
    }

    if (!player) return;

    // Herzen
    for (let i = 0; i < 10; i++) {
      const h = this.heartEls[i];
      const val = player.health - i * 2;
      h.classList.toggle('empty', val <= 0);
      h.classList.toggle('half', val === 1);
      h.classList.toggle('absorbing', false);
    }
    // Hunger
    for (let i = 0; i < 10; i++) {
      const f = this.hungerEls[9 - i];
      const val = player.hunger - i * 2;
      f.classList.toggle('empty', val <= 0);
    }
    // Luft
    const showAir = player.headInWater || player.breath < player.breathMax;
    this.els.air.style.display = showAir ? 'flex' : 'none';
    if (showAir) {
      for (let i = 0; i < 10; i++) {
        const b = this.airEls[i];
        b.classList.toggle('empty', i * 2 >= player.breath);
      }
    }

    // Lebens-/Hungerleisten in Kreativmodus ausblenden
    const survival = player.gamemode === 'survival';
    this.els.hearts.style.visibility = survival ? 'visible' : 'hidden';
    this.els.hunger.style.visibility = survival ? 'visible' : 'hidden';
  }

  /** FPS berechnen und anzeigen. */
  updateFPS(dt) {
    const fps = 1 / Math.max(dt, 0.0001);
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 30) this.fpsHistory.shift();
    this.fps = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
    if (this.els.fps) this.els.fps.textContent = `${this.fps} FPS`;
    return this.fps;
  }

  /** Abbaufortschritt am Crosshair. */
  setBreakProgress(fraction) {
    const el = this.els.breakProgress;
    if (fraction > 0) {
      el.style.display = 'block';
      el.style.setProperty('--p', `${Math.round(fraction * 100)}%`);
      el.innerHTML = `<div class="break-fill" style="width:${Math.round(fraction * 100)}%"></div>`;
    } else {
      el.style.display = 'none';
    }
  }

  /** Schadens-Overlay (roter Blitz). */
  flashHurt() {
    this.els.hurtOverlay.classList.remove('active');
    // Reflow erzwingen
    void this.els.hurtOverlay.offsetWidth;
    this.els.hurtOverlay.classList.add('active');
  }

  setUnderwater(active) {
    this.els.waterOverlay.classList.toggle('active', active);
  }

  setGamemodeLabel(mode, peaceful) {
    if (this.els.modeLabel) {
      const labels = {
        survival: peaceful ? 'Überleben (Friedlich)' : 'Überleben',
        creative: 'Kreativ',
      };
      this.els.modeLabel.textContent = labels[mode] || mode;
    }
  }
}
