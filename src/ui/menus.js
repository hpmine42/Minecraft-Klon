// menus.js — Hauptmenü, Pause, Einstellungen, Inventar/Crafting, Tod, Hilfe.
import { BLOCKS, getName } from '../world/blocks.js';
import { drawTileIcon } from '../world/textures.js';
import { matchRecipe, listRecipes } from '../player/inventory.js';
import { canPlaceFurnaceItem, getSmeltingRecipe } from '../player/furnace.js';
import { markTouchEvent, wasRecentTouch } from '../core/touch.js';

export class Menus {
  constructor(elements, atlasCanvas, inventory, callbacks = {}) {
    this.els = elements;
    this.atlas = atlasCanvas;
    this.inventory = inventory;
    this.cb = callbacks; // { onPlay, onNewWorld, onResume, onSettingsChange, onSave, onQuit, onRespawn, onCraft, onFullscreen }
    this.craftGrid = new Array(9).fill(null);
    this.heldStack = null;
    this.containerSession = null;
    this.containerSlotSignature = null;
    this.containerNotice = null;
    this._slotGesture = null;
    this.selectedSlot = -1;
    this.singleTransferMode = false;
    this.transferSourceIndex = -1;
    this.activeScreen = null;
    this.recipeList = listRecipes();

    this._bindButtons();
    this._buildInventoryUI();
  }

  // -------------------------------------------------------------------------
  // Screen-Verwaltung
  // -------------------------------------------------------------------------
  showScreen(name) {
    const leavingInventory = this.activeScreen === 'inventory-screen' && name !== 'inventory-screen';
    const screens = ['main-menu', 'pause-menu', 'settings-screen', 'inventory-screen', 'death-screen', 'help-screen', 'loading-screen', 'selftest-screen'];
    for (const s of screens) {
      const el = this._el(s);
      if (el) el.classList.toggle('visible', s === name);
    }
    this.activeScreen = name;
    // Der HUD-Vollbildknopf bleibt nur im Spiel sichtbar; über Screen-Karten würden sich Controls optisch überlagern.
    const hudFullscreen = this.els['btn-fullscreen'];
    if (hudFullscreen) hudFullscreen.style.display = name ? 'none' : '';
    if (leavingInventory) this._setSingleTransferMode(false);
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

  /** Normales Inventar mit Crafting-Oberfläche öffnen. */
  openPlayerInventory() {
    this._prepareInventoryMode(null);
    this.showScreen('inventory-screen');
  }

  /** Ofen- und Truhenansichten verwenden dieselben Desktop-/Touch-Slots. */
  openFurnace(state) {
    this._prepareInventoryMode({ type: 'furnace', state, slots: state.slots });
    this.showScreen('inventory-screen');
  }

  openChest(state) {
    this._prepareInventoryMode({ type: 'chest', state, slots: state.slots });
    this.showScreen('inventory-screen');
  }

  _prepareInventoryMode(session) {
    this._setSingleTransferMode(false);
    this._dropHeld();
    this._returnCraftGrid();
    this.containerSession = session;
    this.containerSlotSignature = null;
    this.containerNotice = null;

    const isFurnace = session?.type === 'furnace';
    const isChest = session?.type === 'chest';
    if (this.transferControls) this.transferControls.style.display = session ? 'none' : '';
    if (this.craftWrap) this.craftWrap.style.display = session ? 'none' : '';
    if (this.recipeBook) this.recipeBook.style.display = session ? 'none' : '';
    if (this.furnacePanel) this.furnacePanel.style.display = isFurnace ? '' : 'none';
    if (this.chestPanel) this.chestPanel.style.display = isChest ? '' : 'none';
    if (this.inventoryTitle) {
      this.inventoryTitle.textContent = isFurnace ? 'Schmelzofen' : isChest ? 'Truhe' : 'Inventar & Crafting';
    }
  }

  /** Wird auch beim Schließen per Escape/mobilem Rück-Button aufgerufen. */
  closeActiveInventory() {
    this._setSingleTransferMode(false);
    this._returnCraftGrid();
    this._dropHeld();
    this.containerSession = null;
    this.containerSlotSignature = null;
    this._prepareInventoryMode(null);
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
    click('btn-fullscreen', () => this.cb.onFullscreen && this.cb.onFullscreen());
    click('btn-fullscreen-menu', () => this.cb.onFullscreen && this.cb.onFullscreen());

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
      const label = btn.querySelector && btn.querySelector('.play-menu-label');
      if (label && label.parentElement) {
        label.textContent = has ? 'Spiel fortsetzen' : 'Noch kein Spielstand';
        btn.setAttribute('aria-label', has ? 'Spiel fortsetzen' : 'Kein Spielstand vorhanden');
      } else {
        btn.textContent = has ? '▸ Spiel fortsetzen' : '▸ Spiel fortsetzen (kein Spielstand)';
      }
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

    const transferControls = document.createElement('div');
    transferControls.className = 'craft-transfer-controls';
    const transferButton = document.createElement('button');
    transferButton.type = 'button';
    transferButton.className = 'craft-transfer-toggle';
    transferButton.textContent = 'Einzel-Item-Modus starten';
    transferButton.setAttribute('aria-pressed', 'false');
    const transferStatus = document.createElement('div');
    transferStatus.className = 'craft-transfer-status';
    transferStatus.setAttribute('aria-live', 'polite');
    transferStatus.textContent = 'Ohne Ziehen einzelne Zutaten aus dem Inventar ins 3×3-Feld legen.';
    transferButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (wasRecentTouch()) return;
      this._toggleSingleTransferMode();
    });
    transferButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      markTouchEvent();
      this._toggleSingleTransferMode();
    });
    transferControls.appendChild(transferButton);
    transferControls.appendChild(transferStatus);
    this.craftWrap = craftWrap;
    this.transferControls = transferControls;
    this.singleTransferButton = transferButton;
    this.transferStatus = transferStatus;

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
    this.recipeBook = book;

    // Ofen: Ein-/Brennstoff-/Ausgabe-Slots plus animierte Statusbalken.
    const furnacePanel = document.createElement('section');
    furnacePanel.className = 'furnace-panel';
    furnacePanel.style.display = 'none';
    const furnaceLayout = document.createElement('div');
    furnaceLayout.className = 'furnace-layout';
    this.furnaceSlotEls = [];
    const addFurnaceSlot = (labelText, index, className) => {
      const group = document.createElement('div');
      group.className = `furnace-slot-group ${className}`;
      const label = document.createElement('span');
      label.className = 'furnace-slot-label';
      label.textContent = labelText;
      const slot = this._makeSlot('container', index);
      slot.el.setAttribute('aria-label', labelText);
      group.appendChild(label);
      group.appendChild(slot.el);
      this.furnaceSlotEls[index] = slot;
      return group;
    };
    const inputAndFuel = document.createElement('div');
    inputAndFuel.className = 'furnace-input-column';
    inputAndFuel.appendChild(addFurnaceSlot('Rohstoff', 0, 'furnace-input'));
    inputAndFuel.appendChild(addFurnaceSlot('Brennstoff', 1, 'furnace-fuel'));

    const meters = document.createElement('div');
    meters.className = 'furnace-meters';
    const burnLabel = document.createElement('span');
    burnLabel.className = 'furnace-slot-label';
    burnLabel.textContent = 'Feuer';
    const burnTrack = document.createElement('div');
    burnTrack.className = 'furnace-meter furnace-burn-track';
    const burnFill = document.createElement('div');
    burnFill.className = 'furnace-meter-fill furnace-burn-fill';
    burnTrack.appendChild(burnFill);
    const furnaceArrow = document.createElement('div');
    furnaceArrow.className = 'furnace-cook-arrow';
    furnaceArrow.textContent = '➜';
    const progressLabel = document.createElement('span');
    progressLabel.className = 'furnace-slot-label';
    progressLabel.textContent = 'Schmelzen';
    const progressTrack = document.createElement('div');
    progressTrack.className = 'furnace-meter furnace-progress-track';
    const progressFill = document.createElement('div');
    progressFill.className = 'furnace-meter-fill furnace-progress-fill';
    progressTrack.appendChild(progressFill);
    meters.appendChild(burnLabel);
    meters.appendChild(burnTrack);
    meters.appendChild(furnaceArrow);
    meters.appendChild(progressLabel);
    meters.appendChild(progressTrack);
    this.furnaceBurnFill = burnFill;
    this.furnaceProgressFill = progressFill;

    furnaceLayout.appendChild(inputAndFuel);
    furnaceLayout.appendChild(meters);
    furnaceLayout.appendChild(addFurnaceSlot('Ergebnis', 2, 'furnace-output'));
    furnacePanel.appendChild(furnaceLayout);
    const furnaceStatus = document.createElement('div');
    furnaceStatus.className = 'furnace-status';
    furnaceStatus.setAttribute('aria-live', 'polite');
    furnacePanel.appendChild(furnaceStatus);
    const furnaceHint = document.createElement('div');
    furnaceHint.className = 'furnace-hint';
    furnaceHint.textContent = 'Erze, Sand, Lehm, Holz und rohe Nahrung schmelzen. Kohle, Holzkohle und Holz dienen als Brennstoff.';
    furnacePanel.appendChild(furnaceHint);
    this.furnacePanel = furnacePanel;
    this.furnaceStatus = furnaceStatus;

    // Truhe: 27 persistente Slots, mobil in drei gut antippbaren Reihen.
    const chestPanel = document.createElement('section');
    chestPanel.className = 'chest-panel';
    chestPanel.style.display = 'none';
    const chestLabel = document.createElement('div');
    chestLabel.className = 'craft-label';
    chestLabel.textContent = 'Truheninhalt';
    chestPanel.appendChild(chestLabel);
    const chestGrid = document.createElement('div');
    chestGrid.className = 'inv-grid chest-grid';
    this.chestSlotEls = [];
    for (let i = 0; i < 27; i++) {
      const slot = this._makeSlot('container', i);
      chestGrid.appendChild(slot.el);
      this.chestSlotEls.push(slot);
    }
    chestPanel.appendChild(chestGrid);
    this.chestPanel = chestPanel;
    this.inventoryTitle = this.els['inventory-title'] || this._el('inventory-title');

    // Die Umschaltung bleibt oben im Inventar sichtbar, auch wenn der Slotbereich scrollt.
    root.appendChild(transferControls);
    root.appendChild(furnacePanel);
    root.appendChild(chestPanel);
    root.appendChild(craftWrap);
    root.appendChild(book);

    // Inventarraster
    const invWrap = document.createElement('div');
    invWrap.className = 'inv-wrap';
    const invLabel = document.createElement('div');
    invLabel.className = 'craft-label';
    invLabel.textContent = 'Inventar (antippen oder ziehen zum Aufnehmen/Ablegen)';
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
    this._bindInventoryTouchDrag();

    // Inventar schließen (X)
    const close = this.els['btn-close-inventory'];
    if (close) {
      const closeFn = () => {
        if (this.cb.onCloseInventory) this.cb.onCloseInventory();
        else {
          this.closeActiveInventory();
          this.hideAll();
        }
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
    el.dataset.slotKind = kind;
    el.dataset.slotIndex = String(index);
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

    if (typeof window !== 'undefined' && typeof window.PointerEvent === 'function') {
      el.addEventListener('pointerdown', (e) => this._startInventoryPointer(e, kind, index), { passive: false });
    } else {
      el.addEventListener('touchstart', (e) => this._startInventoryTouch(e, kind, index), { passive: false });
    }
    el.addEventListener('mousedown', (e) => {
      if (wasRecentTouch()) return;
      e.preventDefault();
      e.stopPropagation();
      this._slotClick(kind, index);
    });
    return slot;
  }

  _bindInventoryTouchDrag() {
    if (typeof document === 'undefined' || !document.addEventListener || this._inventoryDragBound) return;
    this._inventoryDragBound = true;
    if (typeof window !== 'undefined' && typeof window.PointerEvent === 'function') {
      document.addEventListener('pointermove', (e) => this._moveInventoryPointer(e), { passive: false });
      document.addEventListener('pointerup', (e) => this._endInventoryPointer(e), { passive: false });
      document.addEventListener('pointercancel', (e) => this._cancelInventoryPointer(e), { passive: false });
    } else {
      // Fallback für ältere Touch-Browser ohne Pointer Events.
      document.addEventListener('touchmove', (e) => this._moveInventoryTouch(e), { passive: false });
      document.addEventListener('touchend', (e) => this._endInventoryTouch(e), { passive: false });
      document.addEventListener('touchcancel', (e) => this._cancelInventoryTouch(e), { passive: false });
    }
  }

  _getSlotStack(kind, index) {
    if (kind === 'result') return matchRecipe(this.craftGrid);
    if (kind === 'craft') return this.craftGrid[index] || null;
    if (kind === 'container') return this.containerSession?.slots[index] || null;
    if (kind === 'inv') return this.inventory.getSlot(index);
    return null;
  }

  _startInventoryPointer(e, kind, index) {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    if (e.isPrimary === false) return;
    e.preventDefault();
    e.stopPropagation();
    markTouchEvent();
    try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch { /* Der Dokument-Fallback reicht aus. */ }

    const sourceStack = this._getSlotStack(kind, index);
    this._slotGesture = {
      inputType: 'pointer',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      canDrag: !this.singleTransferMode && !this.heldStack && !!sourceStack,
      dragging: false,
      lastTarget: null,
    };

    // Tippen bleibt verfügbar: beim Drücken aufnehmen/ablegen, beim Ziehen
    // wird das gewählte Item am Ziel abgelegt.
    this._slotClick(kind, index);
    if (this.heldStack) this._positionFloatingStack(e);
  }

  _moveInventoryPointer(e) {
    const gesture = this._slotGesture;
    if (!gesture || gesture.inputType !== 'pointer' || e.pointerId !== gesture.pointerId || !gesture.canDrag) return;
    this._updateInventoryDrag(e, e);
  }

  _endInventoryPointer(e) {
    const gesture = this._slotGesture;
    if (!gesture || gesture.inputType !== 'pointer' || e.pointerId !== gesture.pointerId) return;
    if (gesture.dragging) {
      e.preventDefault();
      const target = this._slotAtPoint(e.clientX, e.clientY) || gesture.lastTarget;
      if (target) this._slotClick(target.kind, target.index);
    }
    this._clearInventoryDragTarget();
    this._slotGesture = null;
  }

  _cancelInventoryPointer(e) {
    if (this._slotGesture?.inputType !== 'pointer' || e.pointerId !== this._slotGesture.pointerId) return;
    this._clearInventoryDragTarget();
    this._slotGesture = null;
  }

  _startInventoryTouch(e, kind, index) {
    e.preventDefault();
    e.stopPropagation();
    markTouchEvent();

    const touch = e.changedTouches?.[0] || e.touches?.[0] || null;
    const sourceStack = this._getSlotStack(kind, index);
    const canDrag = !this.singleTransferMode && !this.heldStack && !!sourceStack;
    this._slotGesture = {
      inputType: 'touch',
      touchId: touch?.identifier,
      startX: touch?.clientX ?? 0,
      startY: touch?.clientY ?? 0,
      canDrag,
      dragging: false,
      lastTarget: null,
    };

    // Tippen bleibt unverändert: Das Item wird sofort aufgenommen oder abgelegt.
    this._slotClick(kind, index);
    if (this.heldStack && touch) this._positionFloatingStack(touch);
  }

  _touchForSlotGesture(e) {
    const gesture = this._slotGesture;
    if (!gesture || gesture.inputType !== 'touch') return null;
    const find = (list) => {
      if (!list) return null;
      const touches = Array.from(list);
      return touches.find((touch) => touch.identifier === gesture.touchId) || null;
    };
    return find(e.changedTouches) || find(e.touches);
  }

  _moveInventoryTouch(e) {
    const gesture = this._slotGesture;
    const touch = this._touchForSlotGesture(e);
    if (!gesture || gesture.inputType === 'pointer' || !touch || !gesture.canDrag) return;
    this._updateInventoryDrag(e, touch);
  }

  _updateInventoryDrag(event, point) {
    const gesture = this._slotGesture;
    if (!gesture || !point || !gesture.canDrag) return;
    if (!gesture.dragging && Math.hypot(point.clientX - gesture.startX, point.clientY - gesture.startY) >= 8) {
      gesture.dragging = true;
    }
    if (!gesture.dragging) return;

    event.preventDefault();
    markTouchEvent();
    this._positionFloatingStack(point);
    this._setInventoryDragTarget(this._slotAtPoint(point.clientX, point.clientY));
  }

  _endInventoryTouch(e) {
    const gesture = this._slotGesture;
    const touch = this._touchForSlotGesture(e);
    if (!gesture || !touch) return;

    if (gesture.dragging) {
      e.preventDefault();
      const target = this._slotAtPoint(touch.clientX, touch.clientY) || gesture.lastTarget;
      if (target) this._slotClick(target.kind, target.index);
    }
    this._clearInventoryDragTarget();
    this._slotGesture = null;
  }

  _cancelInventoryTouch(e) {
    if (!this._slotGesture || !this._touchForSlotGesture(e)) return;
    this._clearInventoryDragTarget();
    this._slotGesture = null;
  }

  _slotAtPoint(x, y) {
    if (typeof document === 'undefined' || !document.elementFromPoint) return null;
    const hit = document.elementFromPoint(x, y);
    const slotEl = hit?.closest?.('.inv-slot') || (hit?.dataset?.slotKind ? hit : null);
    const kind = slotEl?.dataset?.slotKind;
    const index = Number(slotEl?.dataset?.slotIndex);
    if (!slotEl || !['inv', 'craft', 'result', 'container'].includes(kind) || !Number.isInteger(index)) return null;
    return { el: slotEl, kind, index };
  }

  _setInventoryDragTarget(target) {
    const gesture = this._slotGesture;
    if (!gesture) return;
    if (gesture.lastTarget?.el && gesture.lastTarget.el !== target?.el) {
      gesture.lastTarget.el.classList.remove('drag-over');
    }
    if (target?.el) target.el.classList.add('drag-over');
    gesture.lastTarget = target;
  }

  _clearInventoryDragTarget() {
    const target = this._slotGesture?.lastTarget;
    if (target?.el) target.el.classList.remove('drag-over');
  }

  _positionFloatingStack(touch) {
    const floating = this.floatingEl;
    if (!floating || !touch) return;
    const viewportWidth = (typeof window !== 'undefined' ? window.innerWidth : 0) || document.documentElement?.clientWidth || 0;
    const viewportHeight = (typeof window !== 'undefined' ? window.innerHeight : 0) || document.documentElement?.clientHeight || 0;
    const width = floating.offsetWidth || 140;
    const height = floating.offsetHeight || 48;
    const left = Math.max(8, Math.min(touch.clientX + 14, viewportWidth - width - 8));
    const top = Math.max(8, Math.min(touch.clientY + 14, viewportHeight - height - 8));
    floating.style.left = `${left}px`;
    floating.style.top = `${top}px`;
  }

  _toggleSingleTransferMode() {
    this._setSingleTransferMode(!this.singleTransferMode);
  }

  _setSingleTransferMode(active) {
    active = !!active;
    if (active === this.singleTransferMode) return;
    this._clearInventoryDragTarget();
    this._slotGesture = null;
    if (active && this.heldStack) this._dropHeld();

    this.singleTransferMode = active;
    this.transferSourceIndex = -1;
    if (this.singleTransferButton) {
      this.singleTransferButton.textContent = active
        ? 'Einzel-Item-Modus beenden'
        : 'Einzel-Item-Modus starten';
      this.singleTransferButton.setAttribute('aria-pressed', String(active));
      this.singleTransferButton.classList.toggle('active', active);
    }
    this.refreshInventory();
  }

  _selectTransferSource(index) {
    const stack = this.inventory.getSlot(index);
    if (!stack || stack.count < 1) {
      this.transferSourceIndex = -1;
      this.refreshInventory();
      if (this.transferStatus) this.transferStatus.textContent = 'Der Inventar-Slot ist leer. Wähle einen belegten Slot.';
      return;
    }
    this.transferSourceIndex = index;
    this.refreshInventory();
    this.craftWrap?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  _transferOneToCraft(index) {
    const sourceIndex = this.transferSourceIndex;
    const source = sourceIndex >= 0 ? this.inventory.getSlot(sourceIndex) : null;
    if (!source || source.count < 1) {
      this.transferSourceIndex = -1;
      this.refreshInventory();
      return;
    }

    const target = this.craftGrid[index];
    if (target) {
      const maxStack = BLOCKS[source.id]?.maxStack || 64;
      const canStack = target.id === source.id
        && source.dur == null
        && target.dur == null
        && target.count < maxStack;
      if (!canStack) {
        if (this.transferStatus) {
          this.transferStatus.textContent = target.id !== source.id
            ? `Dieses Feld enthält ${getName(target.id)}. Wähle ein leeres oder passendes Feld.`
            : 'Dieser Stapel ist voll. Wähle ein anderes Crafting-Feld.';
        }
        return;
      }
      target.count += 1;
    } else {
      this.craftGrid[index] = { id: source.id, count: 1, dur: source.dur ?? null };
    }

    source.count -= 1;
    if (source.count <= 0) {
      this.inventory.setSlot(sourceIndex, null);
      this.transferSourceIndex = -1;
    }
    this.refreshInventory();
  }

  _canPlaceInContainer(index, stack) {
    const session = this.containerSession;
    if (!session || !stack) return false;
    if (session.type === 'chest') return index >= 0 && index < session.slots.length;
    if (session.type === 'furnace') return canPlaceFurnaceItem(index, stack.id);
    return false;
  }

  _showContainerNotice(text) {
    this.containerNotice = { text, expiresAt: Date.now() + 1800 };
    if (this.furnaceStatus) this.furnaceStatus.textContent = text;
  }

  _containerSlotClick(index) {
    const session = this.containerSession;
    if (!session || !Number.isInteger(index) || index < 0 || index >= session.slots.length) return;
    const current = session.slots[index];

    if (this.heldStack) {
      if (!this._canPlaceInContainer(index, this.heldStack)) {
        if (session.type === 'furnace') {
          this._showContainerNotice(index === 2
            ? 'Der Ergebnis-Slot kann nicht befüllt werden.'
            : index === 1
              ? 'Dieses Item ist kein Brennstoff.'
              : 'Dieses Item kann nicht geschmolzen werden.');
        }
        return;
      }
      if (!current) {
        session.slots[index] = this.heldStack;
        this.heldStack = null;
      } else if (current.id === this.heldStack.id
          && current.dur == null && this.heldStack.dur == null) {
        const max = BLOCKS[current.id]?.maxStack || 64;
        const moved = Math.min(Math.max(0, max - current.count), this.heldStack.count);
        if (!moved) return;
        current.count += moved;
        this.heldStack.count -= moved;
        if (this.heldStack.count <= 0) this.heldStack = null;
      } else if (this._canPlaceInContainer(index, current)) {
        session.slots[index] = this.heldStack;
        this.heldStack = current;
      } else {
        return;
      }
    } else if (current) {
      this.heldStack = current;
      session.slots[index] = null;
    } else {
      return;
    }

    this.containerNotice = null;
    this.cb.onContainerChange && this.cb.onContainerChange(session.state, session.type, index);
    this.refreshInventory();
  }

  _slotClick(kind, index) {
    if (kind === 'result') {
      this._takeCraftResult();
      return;
    }
    if (kind === 'container') {
      this._containerSlotClick(index);
      return;
    }
    if (this.singleTransferMode) {
      if (kind === 'inv') this._selectTransferSource(index);
      else if (kind === 'craft') this._transferOneToCraft(index);
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
    if (this.containerSession && this.cb.onContainerChange) {
      this.cb.onContainerChange(this.containerSession.state, this.containerSession.type, index);
    }
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

  _drawSlot(slot, stack) {
    if (!slot) return;
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
  }

  _refreshContainerUI() {
    const session = this.containerSession;
    if (!session) return;
    const signature = `${session.type}:${session.slots.map((stack) => stack
      ? `${stack.id}:${stack.count}:${stack.dur ?? ''}`
      : '-').join('|')}`;
    if (signature !== this.containerSlotSignature) {
      const slots = session.type === 'furnace' ? this.furnaceSlotEls : this.chestSlotEls;
      for (let i = 0; i < slots.length; i++) this._drawSlot(slots[i], session.slots[i] || null);
      this.containerSlotSignature = signature;
    }
    if (session.type !== 'furnace') return;

    const state = session.state;
    const input = state.slots[0];
    const recipe = input ? getSmeltingRecipe(input.id) : null;
    const output = state.slots[2];
    const outputFits = !!recipe && (!output
      || (output.id === recipe.id && output.dur == null
        && output.count + recipe.count <= (BLOCKS[recipe.id]?.maxStack || 64)));
    const progress = recipe ? Math.min(1, Math.max(0, state.progress / recipe.seconds)) : 0;
    const burn = state.burnTotal > 0
      ? Math.min(1, Math.max(0, state.burnRemaining / state.burnTotal))
      : 0;
    if (this.furnaceProgressFill) this.furnaceProgressFill.style.width = `${progress * 100}%`;
    if (this.furnaceBurnFill) this.furnaceBurnFill.style.width = `${burn * 100}%`;

    let status;
    if (!input) status = 'Lege einen schmelzbaren Rohstoff ein.';
    else if (!recipe) status = 'Dieser Gegenstand kann hier nicht geschmolzen werden.';
    else if (!outputFits) status = 'Der Ergebnis-Slot ist voll – hole zuerst das Produkt ab.';
    else if (state.burnRemaining > 0) status = `Schmilzt ${getName(input.id)} … ${Math.floor(progress * 100)} %`;
    else if (!state.slots[1]) status = 'Brennstoff fehlt. Kohle, Holzkohle oder Holz einlegen.';
    else if (!canPlaceFurnaceItem(1, state.slots[1].id)) status = 'Das Item im Brennstoff-Slot brennt nicht.';
    else status = 'Bereit – der Ofen startet automatisch.';
    if (this.containerNotice && Date.now() < this.containerNotice.expiresAt) status = this.containerNotice.text;
    else this.containerNotice = null;
    if (this.furnaceStatus) this.furnaceStatus.textContent = status;
  }

  refreshFurnaceUI(state = null) {
    if (this.containerSession?.type !== 'furnace') return;
    if (state && state !== this.containerSession.state) return;
    this._refreshContainerUI();
  }

  /** Alle Slot-Bilder aktualisieren. */
  refreshInventory() {
    for (const slot of this.invSlotEls) {
      this._drawSlot(slot, this.inventory.getSlot(slot.index));
      slot.el.classList.toggle(
        'transfer-source-selected',
        this.singleTransferMode && slot.index === this.transferSourceIndex,
      );
    }
    for (let i = 0; i < 9; i++) {
      this._drawSlot(this.craftSlotEls[i], this.craftGrid[i]);
    }
    const result = matchRecipe(this.craftGrid);
    this._drawSlot(this.resultSlotEl, result ? { id: result.id, count: result.count, dur: null } : null);

    this._refreshContainerUI();

    if (this.transferStatus) {
      const selectedSource = this.transferSourceIndex >= 0
        ? this.inventory.getSlot(this.transferSourceIndex)
        : null;
      if (!this.singleTransferMode) {
        this.transferStatus.textContent = 'Ein Item pro Tipp: Modus starten, Inventar-Slot wählen, dann Crafting-Feld antippen.';
      } else if (!selectedSource) {
        this.transferStatus.textContent = 'Modus an: Tippe einen belegten Inventar-Slot an; danach ein 3×3-Feld. Pro Tipp wandert 1 Item.';
      } else {
        this.transferStatus.textContent = `Ausgewählt: ${getName(selectedSource.id)} ×${selectedSource.count}. Tippe ein Crafting-Feld; je Tipp wandert 1 Item.`;
      }
    }

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
        <li><b>Auf Block tippen &amp; halten:</b> Block direkt unter dem Finger abbauen (wie Pocket Edition)</li>
        <li><b>Wischen:</b> Umsehen; beim Wischen wird nicht abgebaut</li>
        <li><b>⬆ Taste:</b> Springen (2× tippen = Fliegen an/aus)</li>
        <li><b>⬇ Taste:</b> Schleichen umschalten; im Flug sinken (aktiv markiert)</li>
        <li><b>⛏ Taste:</b> Block abbauen / Mob angreifen (halten)</li>
        <li><b>▣ Taste:</b> Block platzieren / Item benutzen</li>
        <li><b>Rucksack:</b> Inventar & Crafting; Items antippen oder direkt ins 3×3-Feld ziehen</li>
        <li><b>Ofen/Truhe:</b> Block ansehen und ▣ antippen; Slots per Tippen oder Ziehen bedienen</li>
        <li><b>Einzel-Item-Modus:</b> Schalter oben im Inventar drücken, Slot wählen und Crafting-Feld antippen; pro Tipp wird 1 Item gelegt</li>
        <li><b>⛶ Taste:</b> Vollbild ein- und ausschalten</li>
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
        <li><b>Rechte Maustaste:</b> Block platzieren / Item benutzen; Ofen und Truhe öffnen</li>
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
        <li>Schmelze Erze, Sand, Lehm, Holz und Fleisch; Kohle oder Holz hält den Ofen am Brennen.</li>
        <li>Truhen lagern 27 Stapel – ihr Inhalt bleibt auch nach dem Laden der Welt erhalten.</li>
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
