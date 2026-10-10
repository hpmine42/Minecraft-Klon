// menus.js — Hauptmenü, Pause, Einstellungen, Inventar/Crafting, Tod, Hilfe.
import { BLOCKS, BLOCK, getName, TOOL } from '../world/blocks.js';
import { drawTileIcon } from '../world/textures.js';
import { matchRecipe, listRecipes, HOTBAR_SIZE } from '../player/inventory.js';
import { markTouchEvent, wasRecentTouch } from '../core/touch.js';

export class Menus {
  constructor(elements, atlasCanvas, inventory, callbacks = {}) {
    this.els = elements;
    this.atlas = atlasCanvas;
    this.inventory = inventory;
    this.cb = callbacks; // { onPlay, onNewWorld, onResume, onSettingsChange, onSave, onQuit, onRespawn, onCraft }
    this.craftGrid = new Array(9).fill(null);
    this.heldStack = null;
    this.selectedSlot = -1;
    this.activeScreen = null;
    this.recipeList = listRecipes();

    this._bindButtons();
    this._buildInventoryUI();
  }

  // -------------------------------------------------------------------------
  // Screen-Verwaltung
  // -------------------------------------------------------------------------
  showScreen(name) {
    const screens = ['main-menu', 'pause-menu', 'settings-screen', 'inventory-screen', 'death-screen', 'help-screen', 'loading-screen', 'selftest-screen'];
    for (const s of screens) {
      const el = this._el(s);
      if (el) el.classList.toggle('visible', s === name);
    }
    this.activeScreen = name;
    if (name === 'inventory-screen') {
      this.refreshInventory();
    }
    if (name === 'settings-screen') {
      this._syncSettingsUI();
    }
  }

  hideAll() {
    this.showScreen(null);
  }

  // -------------------------------------------------------------------------
  // Buttons binden
  // -------------------------------------------------------------------------
  _el(id) {
    return this.els[id] || (typeof document !== 'undefined' ? document.getElementById(id) : null);
  }

  _bindButtons() {
    const click = (id, fn) => {
      const el = this._el(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        if (wasRecentTouch()) return; // Touch-Handler hat schon reagiert
        fn();
      });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        markTouchEvent();
        fn();
      });
    };

    click('btn-play', () => this.cb.onPlay && this.cb.onPlay());
    click('btn-new-world', () => this.cb.onNewWorld && this.cb.onNewWorld());
    click('btn-resume', () => this.cb.onResume && this.cb.onResume());
    click('btn-open-settings', () => this.showScreen('settings-screen'));
    click('btn-settings-back', () => this.showScreen(this._settingsFrom || 'main-menu'));
    click('btn-save', () => this.cb.onSave && this.cb.onSave());
    click('btn-quit', () => this.cb.onQuit && this.cb.onQuit());
    click('btn-respawn', () => this.cb.onRespawn && this.cb.onRespawn());
    click('btn-help', () => this.showScreen('help-screen'));
    click('btn-help-back', () => this.showScreen('main-menu'));
    click('btn-settings-from-pause', () => {
      this._settingsFrom = 'pause-menu';
      this.showScreen('settings-screen');
    });
    click('btn-selftest', () => this.cb.onSelfTest && this.cb.onSelfTest());

    // Einstellungen
    const bindRange = (id, key, format) => {
      const el = this._el(id);
      if (!el) return;
      el.addEventListener('input', () => {
        const v = parseFloat(el.value);
        const label = this._el(`${id}-value`);
        if (label && format) label.textContent = format(v);
        this.cb.onSettingsChange && this.cb.onSettingsChange(key, v);
      });
    };
    bindRange('setting-render-distance', 'renderDistance', (v) => `${v} Chunks`);
    bindRange('setting-fov', 'fov', (v) => `${v}°`);
    bindRange('setting-sensitivity', 'sensitivity', (v) => v.toFixed(4));
    bindRange('setting-volume', 'volume', (v) => `${Math.round(v * 100)} %`);
    bindRange('setting-day-length', 'dayLength', (v) => {
      if (v <= 0) return 'Aus';
      return `${Math.round(v)} s`;
    });

    const bindSelect = (id, key) => {
      const el = this._el(id);
      if (!el) return;
      el.addEventListener('change', () => {
        this.cb.onSettingsChange && this.cb.onSettingsChange(key, el.value);
      });
    };
    bindSelect('setting-particles', 'particles');

    const bindCheck = (id, key) => {
      const el = this._el(id);
      if (!el) return;
      el.addEventListener('change', () => {
        this.cb.onSettingsChange && this.cb.onSettingsChange(key, el.checked);
      });
    };
    bindCheck('setting-invert-y', 'invertY');
    bindCheck('setting-debug', 'showDebug');
    bindCheck('setting-autosave', 'autosave');

    click('btn-reset-world', () => {
      if (confirm('Welt wirklich zurücksetzen? Alle Bauwerke gehen verloren!')) {
        this.cb.onResetWorld && this.cb.onResetWorld();
      }
    });
    click('btn-delete-save', () => {
      if (confirm('Gespeicherte Welt wirklich löschen?')) {
        this.cb.onDeleteSave && this.cb.onDeleteSave();
      }
    });

    // Einstellungen aus Hauptmenü
    const openSettingsFromMain = this.els['btn-open-settings'];
    if (openSettingsFromMain) {
      openSettingsFromMain.addEventListener('click', () => { this._settingsFrom = 'main-menu'; });
    }
  }

  setSettings(values) {
    this._settings = values;
    this._syncSettingsUI();
  }

  _syncSettingsUI() {
    const s = this._settings;
    if (!s) return;
    const setVal = (id, v) => {
      const el = this._el(id);
      if (el) el.value = v;
      const label = this._el(`${id}-value`);
      if (label) {
        if (id === 'setting-render-distance') label.textContent = `${v} Chunks`;
        if (id === 'setting-fov') label.textContent = `${v}°`;
        if (id === 'setting-sensitivity') label.textContent = Number(v).toFixed(4);
        if (id === 'setting-volume') label.textContent = `${Math.round(v * 100)} %`;
        if (id === 'setting-day-length') label.textContent = v <= 0 ? 'Aus' : `${Math.round(v)} s`;
      }
    };
    setVal('setting-render-distance', s.renderDistance);
    setVal('setting-fov', s.fov);
    setVal('setting-sensitivity', s.sensitivity);
    setVal('setting-volume', s.volume);
    setVal('setting-day-length', s.dayLength);
    const setSel = (id, v) => { const el = this._el(id); if (el) el.value = v; };
    setSel('setting-particles', s.particles);
    const setChk = (id, v) => { const el = this._el(id); if (el) el.checked = !!v; };
    setChk('setting-invert-y', s.invertY);
    setChk('setting-debug', s.showDebug);
    setChk('setting-autosave', s.autosave !== false);
  }

  /** Spielstand-Buttons im Hauptmenü aktivieren. */
  setHasSave(has) {
    const btn = this.els['btn-play'];
    if (btn) {
      btn.disabled = !has;
      btn.textContent = has ? '▸ Spiel fortsetzen' : '▸ Spiel fortsetzen (kein Spielstand)';
    }
    const del = this.els['btn-delete-save'];
    if (del) del.style.display = has ? 'inline-block' : 'none';
  }

  // -------------------------------------------------------------------------
  // Inventar + Crafting
  // -------------------------------------------------------------------------
  _buildInventoryUI() {
    const root = this.els['inventory-body'];
    if (!root) return;
    root.innerHTML = '';

    // Crafting 3x3
    const craftWrap = document.createElement('div');
    craftWrap.className = 'craft-wrap';
    const craftLabel = document.createElement('div');
    craftLabel.className = 'craft-label';
    craftLabel.textContent = 'Werkbank / Crafting (3×3)';
    craftWrap.appendChild(craftLabel);

    const craftArea = document.createElement('div');
    craftArea.className = 'craft-area';
    const grid = document.createElement('div');
    grid.className = 'craft-grid';
    this.craftSlotEls = [];
    for (let i = 0; i < 9; i++) {
      const slot = this._makeSlot('craft', i);
      grid.appendChild(slot.el);
      this.craftSlotEls.push(slot);
    }
    const arrow = document.createElement('div');
    arrow.className = 'craft-arrow';
    arrow.textContent = '→';
    const resultSlot = this._makeSlot('result', 0);
    resultSlot.el.classList.add('craft-result');
    this.resultSlotEl = resultSlot;
    craftArea.appendChild(grid);
    craftArea.appendChild(arrow);
    craftArea.appendChild(resultSlot.el);
    craftWrap.appendChild(craftArea);

    // Rezeptbuch
    const book = document.createElement('div');
    book.className = 'recipe-book';
    const bookLabel = document.createElement('div');
    bookLabel.className = 'craft-label';
    bookLabel.textContent = 'Rezeptbuch';
    book.appendChild(bookLabel);
    const bookList = document.createElement('div');
    bookList.className = 'recipe-list';
    for (const recipe of this.recipeList) {
      const row = document.createElement('div');
      row.className = 'recipe-row';
      const icon = document.createElement('canvas');
      icon.width = 28;
      icon.height = 28;
      icon.className = 'item-icon';
      const def = BLOCKS[recipe.result.id];
      if (def && def.tiles) drawTileIcon(icon, def.tiles[0], this.atlas);
      const text = document.createElement('div');
      text.className = 'recipe-text';
      const names = [...new Set(recipe.ingredients)].map((id) => getName(id));
      text.innerHTML = `<b>${recipe.name}</b><br><small>= ${recipe.result.count}× ${getName(recipe.result.id)}<br>benötigt: ${names.join(', ')}</small>`;
      row.appendChild(icon);
      row.appendChild(text);
      bookList.appendChild(row);
    }
    book.appendChild(bookList);

    root.appendChild(craftWrap);
    root.appendChild(book);

    // Inventarraster
    const invWrap = document.createElement('div');
    invWrap.className = 'inv-wrap';
    const invLabel = document.createElement('div');
    invLabel.className = 'craft-label';
    invLabel.textContent = 'Inventar (antippen zum Aufnehmen/Ablegen)';
    invWrap.appendChild(invLabel);

    this.invSlotEls = [];
    const invGrid = document.createElement('div');
    invGrid.className = 'inv-grid';
    for (let i = 9; i < 36; i++) {
      const slot = this._makeSlot('inv', i);
      invGrid.appendChild(slot.el);
      this.invSlotEls.push(slot);
    }
    invWrap.appendChild(invGrid);

    const hotLabel = document.createElement('div');
    hotLabel.className = 'craft-label';
    hotLabel.textContent = 'Schnellleiste';
    invWrap.appendChild(hotLabel);
    const hotGrid = document.createElement('div');
    hotGrid.className = 'inv-grid hotbar-inv';
    for (let i = 0; i < 9; i++) {
      const slot = this._makeSlot('inv', i);
      hotGrid.appendChild(slot.el);
      this.invSlotEls.push(slot);
    }
    invWrap.appendChild(hotGrid);

    // Schwebender Stapel-Anzeige
    const floating = document.createElement('div');
    floating.id = 'floating-stack';
    floating.style.display = 'none';
    invWrap.appendChild(floating);
    this.floatingEl = floating;

    root.appendChild(invWrap);

    // Inventar schließen (X)
    const close = this.els['btn-close-inventory'];
    if (close) {
      const closeFn = () => {
        this._returnCraftGrid();
        this._dropHeld();
        this.cb.onCloseInventory && this.cb.onCloseInventory();
      };
      close.addEventListener('click', () => {
        if (wasRecentTouch()) return;
        closeFn();
      });
      close.addEventListener('touchend', (e) => {
        e.preventDefault();
        markTouchEvent();
        closeFn();
      });
    }
  }

  _makeSlot(kind, index) {
    const el = document.createElement('div');
    el.className = 'inv-slot';
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    canvas.className = 'item-icon';
    const count = document.createElement('span');
    count.className = 'item-count';
    const dur = document.createElement('div');
    dur.className = 'durability-bar';
    dur.innerHTML = '<div></div>';
    el.appendChild(canvas);
    el.appendChild(count);
    el.appendChild(dur);

    const slot = { el, canvas, count, dur, durFill: dur.firstChild, kind, index, stack: null };

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      markTouchEvent();
      this._slotClick(kind, index);
    };
    el.addEventListener('touchstart', handler, { passive: false });
    el.addEventListener('mousedown', (e) => {
      if (wasRecentTouch()) return;
      handler(e);
    });
    return slot;
  }

  _slotClick(kind, index) {
    if (kind === 'result') {
      this._takeCraftResult();
      return;
    }
    if (kind === 'craft') {
      const stack = this.craftGrid[index];
      if (this.heldStack) {
        if (!stack) {
          this.craftGrid[index] = this.heldStack;
          this.heldStack = null;
        } else if (stack.id === this.heldStack.id && stack.dur == null && stack.count < 64) {
          stack.count += this.heldStack.count;
          this.heldStack = null;
        } else {
          this.craftGrid[index] = this.heldStack;
          this.heldStack = stack;
        }
      } else if (stack) {
        this.heldStack = stack;
        this.craftGrid[index] = null;
      }
      this.refreshInventory();
      return;
    }
    // Inventar-Slot
    const stack = this.inventory.slots[index];
    if (this.heldStack) {
      if (!stack) {
        this.inventory.setSlot(index, this.heldStack);
        this.heldStack = null;
      } else if (stack.id === this.heldStack.id && stack.dur == null && (BLOCKS[stack.id]?.maxStack || 64) > stack.count) {
        const max = BLOCKS[stack.id]?.maxStack || 64;
        const move = Math.min(max - stack.count, this.heldStack.count);
        stack.count += move;
        this.heldStack.count -= move;
        if (this.heldStack.count <= 0) this.heldStack = null;
      } else {
        this.inventory.setSlot(index, this.heldStack);
        this.heldStack = stack;
      }
    } else if (stack) {
      this.heldStack = stack;
      this.inventory.setSlot(index, null);
    }
    this.refreshInventory();
  }

  _takeCraftResult() {
    const result = matchRecipe(this.craftGrid);
    if (!result) return;
    if (this.heldStack && (this.heldStack.id !== result.id || this.heldStack.count + result.count > 64)) return;
    if (!this.heldStack) {
      this.heldStack = { id: result.id, count: result.count, dur: BLOCKS[result.id]?.durability > 0 ? BLOCKS[result.id].durability : null };
    } else {
      this.heldStack.count += result.count;
    }
    // Zutaten verbrauchen
    for (let i = 0; i < 9; i++) {
      const s = this.craftGrid[i];
      if (s) {
        s.count -= 1;
        if (s.count <= 0) this.craftGrid[i] = null;
      }
    }
    this.cb.onCraft && this.cb.onCraft(result);
    this.refreshInventory();
  }

  _returnCraftGrid() {
    // Craft-Grid ins Inventar zurück
    for (let i = 0; i < 9; i++) {
      const s = this.craftGrid[i];
      if (s) {
        const leftover = this.inventory.add(s.id, s.count, s.dur);
        if (leftover > 0 && this.cb.onDropStack) this.cb.onDropStack(s.id, leftover);
        this.craftGrid[i] = null;
      }
    }
    this.refreshInventory();
  }

  _dropHeld() {
    if (this.heldStack) {
      const leftover = this.inventory.add(this.heldStack.id, this.heldStack.count, this.heldStack.dur);
      if (leftover > 0 && this.cb.onDropStack) this.cb.onDropStack(this.heldStack.id, leftover);
      this.heldStack = null;
      this.refreshInventory();
    }
  }

  /** Alle Slot-Bilder aktualisieren. */
  refreshInventory() {
    const drawSlot = (slot, stack) => {
      slot.stack = stack;
      if (stack) {
        const def = BLOCKS[stack.id];
        const tile = def && def.tiles ? def.tiles[0] : 0;
        drawTileIcon(slot.canvas, tile, this.atlas);
        slot.canvas.style.visibility = 'visible';
        slot.count.textContent = stack.count > 1 ? String(stack.count) : '';
        if (def && def.durability && stack.dur != null) {
          const frac = stack.dur / def.durability;
          slot.dur.style.visibility = 'visible';
          slot.durFill.style.width = `${Math.max(0, frac * 100)}%`;
          slot.durFill.style.background = frac > 0.5 ? '#4caf50' : frac > 0.25 ? '#ffc107' : '#f44336';
        } else {
          slot.dur.style.visibility = 'hidden';
        }
      } else {
        slot.canvas.style.visibility = 'hidden';
        slot.count.textContent = '';
        slot.dur.style.visibility = 'hidden';
      }
    };

    for (const slot of this.invSlotEls) {
      drawSlot(slot, this.inventory.getSlot(slot.index));
    }
    for (let i = 0; i < 9; i++) {
      drawSlot(this.craftSlotEls[i], this.craftGrid[i]);
    }
    const result = matchRecipe(this.craftGrid);
    drawSlot(this.resultSlotEl, result ? { id: result.id, count: result.count, dur: null } : null);

    // Floating stack
    if (this.floatingEl) {
      if (this.heldStack) {
        this.floatingEl.style.display = 'block';
        this.floatingEl.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const def = BLOCKS[this.heldStack.id];
        if (def && def.tiles) drawTileIcon(canvas, def.tiles[0], this.atlas);
        this.floatingEl.appendChild(canvas);
        const label = document.createElement('div');
        label.textContent = `${getName(this.heldStack.id)}${this.heldStack.count > 1 ? ' ×' + this.heldStack.count : ''}`;
        this.floatingEl.appendChild(label);
      } else {
        this.floatingEl.style.display = 'none';
      }
    }
  }

  // -------------------------------------------------------------------------
  // Hilfe-Text
  // -------------------------------------------------------------------------
  populateHelp(isTouch) {
    const el = this.els['help-content'];
    if (!el) return;
    el.innerHTML = isTouch ? `
      <h3>Handy-Steuerung</h3>
      <ul>
        <li><b>Linker Daumen:</b> Virtueller Joystick zum Bewegen</li>
        <li><b>Rechte Bildschirmhälfte:</b> Wischen zum Umsehen</li>
        <li><b>⬆ Taste:</b> Springen (2× tippen = Fliegen an/aus)</li>
        <li><b>⬇ Taste:</b> Schleichen (Tippen zum Umschalten)</li>
        <li><b>✋ Taste:</b> Block abbauen / Mob angreifen (halten)</li>
        <li><b>▣ Taste:</b> Block platzieren / Item benutzen</li>
        <li><b>Rucksack:</b> Inventar & Crafting</li>
        <li><b>⚙ Taste:</b> Pause / Einstellungen</li>
        <li><b>Hotbar:</b> Antippen zum Itemwechsel</li>
      </ul>
      <h3>Tipps</h3>
      <ul>
        <li>Auf dem Handy ist die Renderdistanz kleiner – in den Einstellungen erhöhbar.</li>
        <li>Im Kreativmodus kannst du fliegen und alle Blöcke platzieren.</li>
        <li>Nachts kommen Zombies – im Friedlich-Modus nicht!</li>
      </ul>
    ` : `
      <h3>Tastatur & Maus</h3>
      <ul>
        <li><b>WASD / Pfeiltasten:</b> Bewegen</li>
        <li><b>Maus:</b> Umsehen (Klick ins Fenster für Mauszeiger-Sperre)</li>
        <li><b>Leertaste:</b> Springen &nbsp;|&nbsp; <b>2× Leertaste:</b> Fliegen (Kreativ)</li>
        <li><b>Shift:</b> Schleichen / Fliegen tiefer &nbsp;|&nbsp; <b>Strg:</b> Sprinten</li>
        <li><b>Linke Maustaste:</b> Block abbauen / angreifen</li>
        <li><b>Rechte Maustaste:</b> Block platzieren / Item benutzen</li>
        <li><b>Mittlere Maustaste:</b> Block kopieren (Kreativ)</li>
        <li><b>Mausrad / 1-9:</b> Schnellleiste</li>
        <li><b>E:</b> Inventar & Crafting &nbsp;|&nbsp; <b>Esc:</b> Pause</li>
        <li><b>F:</b> Fliegen umschalten &nbsp;|&nbsp; <b>F3:</b> Debug-Infos</li>
        <li><b>M:</b> Spielmodus wechseln &nbsp;|&nbsp; <b>P:</b> Friedlich umschalten</li>
        <li><b>T:</b> Tag/Nacht springen &nbsp;|&nbsp; <b>O:</b> Wetter umschalten</li>
        <li><b>F5:</b> Spiel speichern</li>
      </ul>
      <h3>Überleben</h3>
      <ul>
        <li>Grabe Holz → Bretter → Stöcke → Werkbank → Werkzeuge.</li>
        <li>Mit der Hacke machst du Ackerboden, darauf Samen pflanzen.</li>
        <li>Tiere liefern Fleisch (im Ofen garen), Zombies droppen Knochen.</li>
        <li>Suche nach Kohle, Eisen, Gold und Diamanten in Höhlen.</li>
        <li>Fackeln erhellen Höhlen und halten Zombies fern.</li>
      </ul>
    `;
  }

  /** Zeigt "Spiel wird geladen..." mit Hinweistext. */
  setLoading(text) {
    const el = this.els['loading-text'];
    if (el) el.textContent = text || 'Welt wird generiert…';
    this.showScreen('loading-screen');
  }

  setDeathScreen(stats = {}) {
    const el = this.els['death-stats'];
    if (el) {
      el.textContent = stats.text || '';
    }
    this.showScreen('death-screen');
  }
}
