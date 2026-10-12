// menus.js — Hauptmenü, Pause, Einstellungen, Inventar/Crafting, Tod, Hilfe.
import { BLOCKS, getName } from '../world/blocks.js';
import { drawTileIcon } from '../world/textures.js';
import { matchRecipe, listRecipes, makeStack, canEquipItem, stacksEqual, EQUIPMENT_SLOTS } from '../player/inventory.js';
import { canPlaceFurnaceItem, getSmeltingRecipe } from '../player/furnace.js';
import { markTouchEvent, wasRecentTouch } from '../core/touch.js';

export class Menus {
  constructor(elements, atlasCanvas, inventory, callbacks = {}) {
    this.els = elements;
    this.atlas = atlasCanvas;
    this.inventory = inventory;
    this.cb = callbacks; // { onPlay, onNewWorld, onResume, onSettingsChange, onSave, onQuit, onRespawn, onCraft, onFullscreen }
    this.craftGrid = new Array(4).fill(null);
    this.craftingMode = 'player';
    this.craftRemainder = null;
    this.heldStack = null;
    this.containerSession = null;
    this.containerSlotSignature = null;
    this.containerNotice = null;
    this._slotGesture = null;
    this._mouseGesture = null;
    this._desktopMouseBound = false;
    this._hoveredInventorySlot = null;
    this.inventoryTooltip = null;
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

  /** Normales Inventar mit dem klassischen 2×2-Spielercrafting öffnen. */
  openPlayerInventory() {
    this._prepareInventoryMode(null);
    this._setCraftingMode('player');
    this.showScreen('inventory-screen');
  }

  /** Eine Werkbank behält das größere 3×3-Crafting-Raster. */
  openWorkbenchInventory() {
    this._prepareInventoryMode(null);
    this._setCraftingMode('workbench');
    if (this.inventoryTitle) this.inventoryTitle.textContent = 'Werkbank';
    this.showScreen('inventory-screen');
  }

  /** Ofen- und Truhenansichten verwenden dieselben Desktop-/Touch-Slots. */
  openFurnace(state) {
    this._prepareInventoryMode({ type: 'furnace', state, slots: state.slots });
    this._setCraftingMode('player');
    this.showScreen('inventory-screen');
  }

  openChest(state) {
    this._prepareInventoryMode({ type: 'chest', state, slots: state.slots });
    this._setCraftingMode('player');
    this.showScreen('inventory-screen');
  }

  _prepareInventoryMode(session) {
    this._setSingleTransferMode(false);
    this._dropHeld();
    this._returnCraftGrid();
    this._returnCraftRemainder();
    this.containerSession = session;
    this.containerSlotSignature = null;
    this.containerNotice = null;

    const isFurnace = session?.type === 'furnace';
    const isChest = session?.type === 'chest';
    if (this.transferControls) this.transferControls.style.display = session ? 'none' : '';
    if (this.playerSidePanel) this.playerSidePanel.style.display = session ? 'none' : '';
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
    this._returnCraftRemainder();
    this._dropHeld();
    this.containerSession = null;
    this.containerSlotSignature = null;
    this._prepareInventoryMode(null);
    this._setCraftingMode('player');
    if (this.inventoryTooltip) this.inventoryTooltip.style.display = 'none';
  }

  _setCraftingMode(mode) {
    this.craftingMode = mode === 'workbench' ? 'workbench' : 'player';
    const size = this.craftingMode === 'workbench' ? 9 : 4;
    if (this.craftGrid.length !== size) this.craftGrid = new Array(size).fill(null);
    if (this.craftGridEl) {
      this.craftGridEl.classList.toggle('player-craft-grid', size === 4);
    }
    for (let i = 0; i < (this.craftSlotEls?.length || 0); i++) {
      this.craftSlotEls[i].el.style.display = i < size ? '' : 'none';
    }
    if (this.craftLabel) {
      this.craftLabel.textContent = size === 4 ? 'Spielercrafting (2×2)' : 'Werkbank-Crafting (3×3)';
    }
    if (this.transferStatus) {
      this.transferStatus.textContent = `Ohne Ziehen einzelne Zutaten aus dem Inventar ins ${size === 4 ? '2×2' : '3×3'}-Feld legen.`;
    }
    this.refreshInventory();
  }

  /** Temporäre Cursor- und Craftingstapel werden zusammen mit dem Spielstand gesichert. */
  serializeInventoryState() {
    const serialize = (stack) => (stack ? { ...stack } : null);
    return {
      craftingMode: this.craftingMode,
      craftGrid: this.craftGrid.map(serialize),
      craftRemainder: serialize(this.craftRemainder),
      heldStack: serialize(this.heldStack),
    };
  }

  restoreInventoryState(data) {
    if (!data || typeof data !== 'object') {
      this.resetInventoryState();
      return;
    }
    this.craftingMode = data.craftingMode === 'workbench' ? 'workbench' : 'player';
    const size = this.craftingMode === 'workbench' ? 9 : 4;
    this.craftGrid = new Array(size).fill(null);
    if (Array.isArray(data.craftGrid)) {
      for (let i = 0; i < Math.min(size, data.craftGrid.length); i++) {
        const stack = data.craftGrid[i];
        if (stack) this.craftGrid[i] = makeStack(stack.id, stack.count, stack.dur, stack.meta);
      }
    }
    const remainder = data.craftRemainder;
    this.craftRemainder = remainder ? makeStack(remainder.id, remainder.count, remainder.dur, remainder.meta) : null;
    const held = data.heldStack;
    this.heldStack = held ? makeStack(held.id, held.count, held.dur, held.meta) : null;
    this._setCraftingMode(this.craftingMode);
    this.refreshInventory();
  }

  resetInventoryState() {
    this.craftGrid = new Array(4).fill(null);
    this.craftingMode = 'player';
    this.craftRemainder = null;
    this.heldStack = null;
    this.containerSession = null;
    this._setCraftingMode('player');
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
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    // Spielercrafting: vier Slots. Die fünf übrigen werden nur an der Werkbank eingeblendet.
    const craftWrap = document.createElement('div');
    craftWrap.className = 'craft-wrap';
    const craftLabel = document.createElement('div');
    craftLabel.className = 'craft-label';
    craftLabel.textContent = 'Spielercrafting (2×2)';
    craftWrap.appendChild(craftLabel);
    this.craftLabel = craftLabel;

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
    transferStatus.textContent = 'Ohne Ziehen einzelne Zutaten aus dem Inventar ins 2×2-Feld legen.';
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
    grid.className = 'craft-grid player-craft-grid';
    this.craftGridEl = grid;
    this.craftSlotEls = [];
    for (let i = 0; i < 9; i++) {
      const slot = this._makeSlot('craft', i);
      if (i >= 4) slot.el.style.display = 'none';
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

    // Ausrüstungsfeld und einfache Pixel-Charaktervorschau. Rüstungsslots
    // akzeptieren ausschließlich Items mit einer passenden echten Itemdefinition.
    const playerSidePanel = document.createElement('section');
    playerSidePanel.className = 'player-side-panel';
    const characterHeading = document.createElement('div');
    characterHeading.className = 'craft-label';
    characterHeading.textContent = 'Charakter & Ausrüstung';
    playerSidePanel.appendChild(characterHeading);

    const equipmentStage = document.createElement('div');
    equipmentStage.className = 'equipment-stage';
    const armorColumn = document.createElement('div');
    armorColumn.className = 'equipment-column';
    this.equipmentSlotEls = {};
    const equipmentLabels = { head: 'Kopf', chest: 'Brust', legs: 'Beine', feet: 'Füße', offhand: 'Nebenhand' };
    for (const slotName of EQUIPMENT_SLOTS.slice(0, 4)) {
      const group = document.createElement('div');
      group.className = 'equipment-slot-group';
      const label = document.createElement('span');
      label.className = 'equipment-slot-label';
      label.textContent = equipmentLabels[slotName];
      const slot = this._makeSlot('equipment', EQUIPMENT_SLOTS.indexOf(slotName));
      slot.el.setAttribute('aria-label', `${equipmentLabels[slotName]}-Ausrüstung`);
      group.appendChild(label);
      group.appendChild(slot.el);
      this.equipmentSlotEls[slotName] = slot;
      armorColumn.appendChild(group);
    }
    const characterFigure = document.createElement('div');
    characterFigure.className = 'character-figure';
    const characterCanvas = document.createElement('canvas');
    characterCanvas.width = 96;
    characterCanvas.height = 128;
    characterCanvas.className = 'character-preview';
    characterCanvas.setAttribute('role', 'img');
    characterCanvas.setAttribute('aria-label', 'Pixel-Charaktervorschau');
    this.characterCanvas = characterCanvas;
    this._drawCharacterPreview();
    const characterCaption = document.createElement('span');
    characterCaption.className = 'character-caption';
    characterCaption.textContent = 'Spieler';
    characterFigure.appendChild(characterCanvas);
    characterFigure.appendChild(characterCaption);

    const offhandGroup = document.createElement('div');
    offhandGroup.className = 'equipment-slot-group offhand-slot-group';
    const offhandLabel = document.createElement('span');
    offhandLabel.className = 'equipment-slot-label';
    offhandLabel.textContent = equipmentLabels.offhand;
    const offhandSlot = this._makeSlot('equipment', EQUIPMENT_SLOTS.indexOf('offhand'));
    offhandSlot.el.setAttribute('aria-label', 'Nebenhand');
    this.equipmentSlotEls.offhand = offhandSlot;
    offhandGroup.appendChild(offhandLabel);
    offhandGroup.appendChild(offhandSlot.el);

    equipmentStage.appendChild(armorColumn);
    equipmentStage.appendChild(characterFigure);
    equipmentStage.appendChild(offhandGroup);
    playerSidePanel.appendChild(equipmentStage);
    playerSidePanel.appendChild(craftWrap);
    this.playerSidePanel = playerSidePanel;

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

    const inventoryLayout = document.createElement('div');
    inventoryLayout.className = 'player-inventory-layout';
    inventoryLayout.appendChild(playerSidePanel);
    inventoryLayout.appendChild(invWrap);
    this.inventoryLayout = inventoryLayout;

    // Die Crafting-Umschaltung bleibt oben sichtbar, auch wenn der Slotbereich scrollt.
    root.appendChild(transferControls);
    root.appendChild(furnacePanel);
    root.appendChild(chestPanel);
    root.appendChild(inventoryLayout);
    root.appendChild(book);

    const tooltip = document.createElement('div');
    tooltip.className = 'inventory-tooltip';
    tooltip.style.display = 'none';
    if (document.body?.appendChild) document.body.appendChild(tooltip);
    else root.appendChild(tooltip);
    this.inventoryTooltip = tooltip;

    this._bindInventoryTouchDrag();
    this._bindDesktopInventoryMouse();

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

  _drawCharacterPreview() {
    const context = this.characterCanvas?.getContext?.('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, 96, 128);
    context.fillStyle = 'rgba(5, 8, 12, 0.3)';
    context.fillRect(5, 4, 86, 120);
    // Ein neutrales Pixelmodell dient als Vorschau; das Projekt definiert derzeit
    // keine Rüstungs- oder Spieler-Skin-Items.
    context.fillStyle = '#263238';
    context.fillRect(33, 86, 13, 31);
    context.fillRect(50, 86, 13, 31);
    context.fillStyle = '#293b56';
    context.fillRect(30, 112, 18, 8);
    context.fillRect(48, 112, 18, 8);
    context.fillStyle = '#315a9a';
    context.fillRect(27, 38, 42, 49);
    context.fillRect(18, 41, 10, 35);
    context.fillRect(68, 41, 10, 35);
    context.fillStyle = '#2b4d83';
    context.fillRect(18, 72, 10, 9);
    context.fillRect(68, 72, 10, 9);
    context.fillStyle = '#d8aa82';
    context.fillRect(39, 30, 18, 11);
    context.fillRect(34, 8, 28, 25);
    context.fillStyle = '#503a2d';
    context.fillRect(34, 7, 28, 8);
    context.fillRect(34, 13, 5, 10);
    context.fillStyle = '#263238';
    context.fillRect(40, 19, 4, 4);
    context.fillRect(53, 19, 4, 4);
    context.fillStyle = '#f0d2b7';
    context.fillRect(44, 28, 10, 2);
    context.fillStyle = '#7b5338';
    context.fillRect(27, 38, 42, 4);
    context.fillRect(31, 83, 34, 4);
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
    el.addEventListener('mousedown', (e) => this._startDesktopInventoryMouse(e, kind, index));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
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

  _bindDesktopInventoryMouse() {
    if (typeof document === 'undefined' || !document.addEventListener || this._desktopMouseBound) return;
    this._desktopMouseBound = true;
    document.addEventListener('mousemove', (e) => this._moveDesktopInventoryMouse(e));
    document.addEventListener('mouseup', (e) => this._endDesktopInventoryMouse(e));
  }

  _sameSlot(a, b) {
    return !!a && !!b && a.kind === b.kind && a.index === b.index;
  }

  _startDesktopInventoryMouse(e, kind, index) {
    if (wasRecentTouch() || (e.button !== 0 && e.button !== 2)) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.shiftKey) {
      if (!this.singleTransferMode && e.button === 0) this._shiftClick(kind, index);
      return;
    }

    if (this.singleTransferMode) {
      if (e.button === 0) this._slotClick(kind, index, 0);
      return;
    }

    const pickedUpAtStart = !this.heldStack;
    if (pickedUpAtStart) {
      this._slotClick(kind, index, e.button);
      if (!this.heldStack) return;
    }
    const gesture = {
      button: e.button,
      startTarget: { kind, index },
      pickedUpAtStart,
      targets: [],
      hoverTarget: null,
    };
    this._mouseGesture = gesture;
    if (!pickedUpAtStart) this._recordMouseDropTarget(gesture, { kind, index });
    if (this.heldStack) this._positionFloatingStack(e);
  }

  _moveDesktopInventoryMouse(e) {
    if (this.heldStack) this._positionFloatingStack(e);
    const target = this._slotAtPoint(e.clientX, e.clientY);
    this._updateInventoryHover(target, e);

    const gesture = this._mouseGesture;
    if (!gesture) return;
    if (gesture.hoverTarget?.el && gesture.hoverTarget.el !== target?.el) {
      gesture.hoverTarget.el.classList.remove('drag-over');
    }
    if (target?.el) target.el.classList.add('drag-over');
    gesture.hoverTarget = target;

    if (target && !(gesture.pickedUpAtStart && this._sameSlot(target, gesture.startTarget))) {
      this._recordMouseDropTarget(gesture, target);
    }
  }

  _updateInventoryHover(target, point = null) {
    const previous = this._hoveredInventorySlot;
    if (previous?.el && previous.el !== target?.el) previous.el.classList.remove('hovered');
    if (target?.el) target.el.classList.add('hovered');
    this._hoveredInventorySlot = target || null;

    const tooltip = this.inventoryTooltip;
    const stack = target ? this._getSlotStack(target.kind, target.index) : null;
    if (!tooltip || !stack) {
      if (tooltip) tooltip.style.display = 'none';
      return;
    }

    const def = BLOCKS[stack.id];
    const durability = def?.durability > 0 && stack.dur != null
      ? ` · Haltbarkeit ${stack.dur}/${def.durability}`
      : '';
    tooltip.textContent = `${getName(stack.id)}${stack.count > 1 ? ` ×${stack.count}` : ''}${durability}`;
    tooltip.style.display = 'block';
    if (point) {
      const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
      const width = tooltip.offsetWidth || 190;
      const height = tooltip.offsetHeight || 30;
      tooltip.style.left = `${Math.max(8, Math.min(point.clientX + 14, viewportWidth - width - 8))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(point.clientY + 14, viewportHeight - height - 8))}px`;
    }
  }

  _endDesktopInventoryMouse(e) {
    const gesture = this._mouseGesture;
    if (!gesture || (e.button != null && e.button !== gesture.button)) return;
    const endTarget = this._slotAtPoint(e.clientX, e.clientY);
    const endedOnSameSlot = this._sameSlot(endTarget, gesture.startTarget);
    const endedOnDifferentSlot = !!endTarget && !endedOnSameSlot;

    if (gesture.pickedUpAtStart) {
      // Beim Aufnehmen per Drag bleibt der Cursor-Stapel hängen, falls man
      // nur geklickt hat. Wird auf einem anderen Slot losgelassen, wird gelegt.
      if (endedOnDifferentSlot) {
        this._recordMouseDropTarget(gesture, endTarget);
        this._distributeMouseStack(gesture.button, gesture.targets);
      }
    } else if (endedOnSameSlot) {
      // Kein echter Drag: normale Minecraft-Linksklick-/Rechtsklick-Regeln,
      // einschließlich Tauschen verschiedener Stapel.
      this._slotClick(gesture.startTarget.kind, gesture.startTarget.index, gesture.button);
    } else if (endedOnDifferentSlot) {
      this._recordMouseDropTarget(gesture, endTarget);
      this._distributeMouseStack(gesture.button, gesture.targets);
    }

    if (gesture.hoverTarget?.el) gesture.hoverTarget.el.classList.remove('drag-over');
    this._mouseGesture = null;
  }

  _canPlaceInSlot(kind, index, stack) {
    if (!stack || kind === 'result') return false;
    if (kind === 'inv') return true;
    if (kind === 'craft') return index >= 0 && index < this.craftGrid.length;
    if (kind === 'equipment') return canEquipItem(stack, EQUIPMENT_SLOTS[index]);
    if (kind === 'container') return this._canPlaceInContainer(index, stack);
    return false;
  }

  _mouseTargetCapacity(target) {
    if (!target || !this.heldStack || !this._canPlaceInSlot(target.kind, target.index, this.heldStack)) return 0;
    const current = this._getSlotStack(target.kind, target.index);
    const slotName = target.kind === 'equipment' ? EQUIPMENT_SLOTS[target.index] : null;
    const max = slotName && slotName !== 'offhand' ? 1 : (BLOCKS[this.heldStack.id]?.maxStack || 64);
    if (!current) return max;
    if (stacksEqual(current, this.heldStack)) return Math.max(0, max - current.count);
    return 0;
  }

  _recordMouseDropTarget(gesture, target) {
    if (!target || this._mouseTargetCapacity(target) < 1) return;
    if (gesture.targets.some((candidate) => this._sameSlot(candidate, target))) return;
    gesture.targets.push(target);
  }

  _setSlotStack(kind, index, stack) {
    if (kind === 'inv') this.inventory.setSlot(index, stack);
    else if (kind === 'craft' && index >= 0 && index < this.craftGrid.length) this.craftGrid[index] = stack;
    else if (kind === 'equipment') this.inventory.setEquipment(EQUIPMENT_SLOTS[index], stack);
    else if (kind === 'container' && this.containerSession) this.containerSession.slots[index] = stack;
  }

  _putHeldCountInSlot(target, count) {
    if (!this.heldStack || count < 1 || this._mouseTargetCapacity(target) < count) return 0;
    const current = this._getSlotStack(target.kind, target.index);
    if (current) current.count += count;
    else this._setSlotStack(target.kind, target.index, {
      id: this.heldStack.id,
      count,
      dur: this.heldStack.dur ?? null,
      meta: this.heldStack.meta,
    });
    return count;
  }

  _distributeMouseStack(button, targets) {
    if (!this.heldStack || !targets?.length) return;
    let changed = false;
    if (button === 2) {
      // Minecraft-Rechtsziehen: genau ein Item pro belegbarem Slot.
      for (const target of targets) {
        if (!this.heldStack) break;
        const placed = this._putHeldCountInSlot(target, 1);
        if (!placed) continue;
        this.heldStack.count -= placed;
        changed = true;
      }
    } else {
      // Minecraft-Linksziehen: Stapel möglichst gleichmäßig verteilen.
      let remaining = this.heldStack.count;
      let openTargets = targets.filter((target) => this._mouseTargetCapacity(target) > 0).length;
      for (const target of targets) {
        if (remaining <= 0 || openTargets <= 0) break;
        const capacity = this._mouseTargetCapacity(target);
        if (capacity <= 0) continue;
        const share = Math.ceil(remaining / openTargets);
        const placed = this._putHeldCountInSlot(target, Math.min(share, capacity, remaining));
        remaining -= placed;
        openTargets -= 1;
        changed ||= placed > 0;
      }
      this.heldStack.count = remaining;
    }

    if (this.heldStack?.count <= 0) this.heldStack = null;
    if (!changed) return;
    this.refreshInventory();
    if (this.containerSession && this.cb.onContainerChange) {
      this.cb.onContainerChange(this.containerSession.state, this.containerSession.type, -1);
    }
  }

  _getSlotStack(kind, index) {
    if (kind === 'result') return this.craftRemainder || matchRecipe(this.craftGrid);
    if (kind === 'craft') return this.craftGrid[index] || null;
    if (kind === 'container') return this.containerSession?.slots[index] || null;
    if (kind === 'equipment') return this.inventory.getEquipment(EQUIPMENT_SLOTS[index]);
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
    if (!slotEl || !['inv', 'craft', 'result', 'container', 'equipment'].includes(kind) || !Number.isInteger(index)) return null;
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
    if (!Number.isInteger(index) || index < 0 || index >= this.craftGrid.length) return;
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
      const canStack = stacksEqual(target, source) && target.count < maxStack;
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
      this.craftGrid[index] = makeStack(source.id, 1, source.dur, source.meta);
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

  _furnaceOutputClick(button = 0) {
    const session = this.containerSession;
    const output = session?.type === 'furnace' ? session.slots[2] : null;
    if (!output) return;

    if (!this.heldStack) {
      const count = button === 2 ? Math.ceil(output.count / 2) : output.count;
      this.heldStack = { ...output, count };
      output.count -= count;
      if (output.count <= 0) session.slots[2] = null;
    } else if (this.heldStack.id === output.id
        && this.heldStack.dur == null && output.dur == null) {
      const max = BLOCKS[output.id]?.maxStack || 64;
      const count = button === 2
        ? Math.min(1, output.count, max - this.heldStack.count)
        : Math.min(output.count, max - this.heldStack.count);
      if (count <= 0) return;
      this.heldStack.count += count;
      output.count -= count;
      if (output.count <= 0) session.slots[2] = null;
    } else {
      return;
    }

    this.cb.onContainerChange && this.cb.onContainerChange(session.state, session.type, 2);
    this.refreshInventory();
  }

  _containerSlotClick(index, button = 0) {
    const session = this.containerSession;
    if (!session || !Number.isInteger(index) || index < 0 || index >= session.slots.length) return;
    if (session.type === 'furnace' && index === 2) {
      this._furnaceOutputClick(button);
      return;
    }

    if (this.heldStack && !this._canPlaceInContainer(index, this.heldStack)) {
      if (session.type === 'furnace') {
        this._showContainerNotice(index === 1
          ? 'Dieses Item ist kein Brennstoff.'
          : 'Dieses Item kann nicht geschmolzen werden.');
      }
      return;
    }
    if (!this._handleStackSlotClick('container', index, button)) return;

    this.containerNotice = null;
    this.cb.onContainerChange && this.cb.onContainerChange(session.state, session.type, index);
    this.refreshInventory();
  }

  _handleStackSlotClick(kind, index, button = 0) {
    const current = this._getSlotStack(kind, index);
    const rightClick = button === 2;

    if (!this.heldStack) {
      if (!current) return false;
      if (rightClick) {
        const count = Math.ceil(current.count / 2);
        this.heldStack = { ...current, count };
        current.count -= count;
        if (current.count <= 0) this._setSlotStack(kind, index, null);
      } else {
        this.heldStack = current;
        this._setSlotStack(kind, index, null);
      }
      return true;
    }

    if (!this._canPlaceInSlot(kind, index, this.heldStack)) return false;
    if (!current) {
      const equipmentSlot = kind === 'equipment' ? EQUIPMENT_SLOTS[index] : null;
      const singleEquipmentItem = equipmentSlot && equipmentSlot !== 'offhand';
      if (rightClick || singleEquipmentItem) {
        this._setSlotStack(kind, index, {
          id: this.heldStack.id,
          count: 1,
          dur: this.heldStack.dur ?? null,
          meta: this.heldStack.meta,
        });
        this.heldStack.count -= 1;
        if (this.heldStack.count <= 0) this.heldStack = null;
      } else {
        this._setSlotStack(kind, index, this.heldStack);
        this.heldStack = null;
      }
      return true;
    }

    if (stacksEqual(current, this.heldStack)) {
      const equipmentSlot = kind === 'equipment' ? EQUIPMENT_SLOTS[index] : null;
      const max = equipmentSlot && equipmentSlot !== 'offhand'
        ? 1
        : (BLOCKS[current.id]?.maxStack || 64);
      const available = Math.max(0, max - current.count);
      const moved = rightClick
        ? Math.min(1, available, this.heldStack.count)
        : Math.min(available, this.heldStack.count);
      if (!moved) return false;
      current.count += moved;
      this.heldStack.count -= moved;
      if (this.heldStack.count <= 0) this.heldStack = null;
      return true;
    }

    if (!rightClick && this._canPlaceInSlot(kind, index, current)) {
      this._setSlotStack(kind, index, this.heldStack);
      this.heldStack = current;
      return true;
    }
    return false;
  }

  _inventoryTargets(indices = null) {
    const order = indices || Array.from({ length: 36 }, (_, index) => index);
    return order.map((index) => ({ kind: 'inv', index }));
  }

  _inventoryCapacity(stack) {
    if (!stack) return 0;
    const def = BLOCKS[stack.id];
    const max = Math.max(1, Number(def?.maxStack) || 64);
    let capacity = 0;
    for (const current of this.inventory.slots) {
      if (!current) capacity += max;
      else if (max > 1 && stacksEqual(current, stack)) capacity += Math.max(0, max - current.count);
    }
    return capacity;
  }

  _consumeCraftIngredients() {
    for (let i = 0; i < this.craftGrid.length; i++) {
      const stack = this.craftGrid[i];
      if (!stack) continue;
      stack.count -= 1;
      if (stack.count <= 0) this.craftGrid[i] = null;
    }
  }

  _craftResultIntoInventory() {
    if (this.heldStack) return false;
    let changed = false;
    for (let crafts = 0; crafts < 128; crafts++) {
      if (this.craftRemainder) {
        const remainder = this.craftRemainder;
        const amount = Math.min(remainder.count, this._inventoryCapacity(remainder));
        if (amount <= 0) break;
        const leftover = this.inventory.add(remainder.id, amount, remainder.dur, remainder.meta);
        const moved = amount - leftover;
        if (moved <= 0) break;
        remainder.count -= moved;
        if (remainder.count <= 0) this.craftRemainder = null;
        changed = true;
        if (leftover > 0) break;
        continue;
      }

      const result = matchRecipe(this.craftGrid);
      if (!result) break;
      const resultStack = makeStack(result.id, result.count);
      if (!resultStack || this._inventoryCapacity(resultStack) < result.count) break;
      const leftover = this.inventory.add(result.id, result.count, resultStack.dur, resultStack.meta);
      if (leftover > 0) break;
      this._consumeCraftIngredients();
      this.cb.onCraft && this.cb.onCraft(result);
      changed = true;
    }
    if (changed) this.refreshInventory();
    return changed;
  }

  _shiftClick(kind, index) {
    if (kind === 'result') {
      this._craftResultIntoInventory();
      return;
    }
    const sourceStack = this._getSlotStack(kind, index);
    if (!sourceStack) return;

    if (kind === 'inv') {
      if (this.containerSession?.type === 'chest') {
        this._transferStackBetweenSlots(kind, index,
          Array.from({ length: this.containerSession.slots.length }, (_, targetIndex) => ({ kind: 'container', index: targetIndex })));
        return;
      }
      if (this.containerSession?.type === 'furnace') {
        const targetIndex = canPlaceFurnaceItem(0, sourceStack.id) ? 0
          : canPlaceFurnaceItem(1, sourceStack.id) ? 1 : -1;
        if (targetIndex >= 0) this._transferStackBetweenSlots(kind, index, [{ kind: 'container', index: targetIndex }]);
        return;
      }

      const equipmentSlot = BLOCKS[sourceStack.id]?.equipmentSlot;
      if (EQUIPMENT_SLOTS.includes(equipmentSlot) && equipmentSlot !== 'offhand'
          && !this.inventory.getEquipment(equipmentSlot)) {
        const moved = this._transferStackBetweenSlots(kind, index, [
          { kind: 'equipment', index: EQUIPMENT_SLOTS.indexOf(equipmentSlot) },
        ]);
        if (moved) return;
      }
      const targets = index < 9
        ? Array.from({ length: 27 }, (_, offset) => ({ kind: 'inv', index: offset + 9 }))
        : Array.from({ length: 9 }, (_, targetIndex) => ({ kind: 'inv', index: targetIndex }));
      this._transferStackBetweenSlots(kind, index, targets);
      return;
    }

    if (kind === 'container' && this.containerSession?.type === 'furnace' && index === 2) {
      this._transferStackBetweenSlots(kind, index, this._inventoryTargets());
      return;
    }
    if (kind === 'container' || kind === 'craft' || kind === 'equipment') {
      this._transferStackBetweenSlots(kind, index, this._inventoryTargets());
    }
  }

  _transferStackBetweenSlots(sourceKind, sourceIndex, targets) {
    const original = this._getSlotStack(sourceKind, sourceIndex);
    if (!original) return false;
    let remaining = original.count;
    const moving = { ...original };
    let changed = false;

    for (const target of targets) {
      if (remaining <= 0 || (target.kind === sourceKind && target.index === sourceIndex)) continue;
      if (!this._canPlaceInSlot(target.kind, target.index, moving)) continue;
      const current = this._getSlotStack(target.kind, target.index);
      const equipmentSlot = target.kind === 'equipment' ? EQUIPMENT_SLOTS[target.index] : null;
      const max = equipmentSlot && equipmentSlot !== 'offhand'
        ? 1
        : Math.max(1, Number(BLOCKS[moving.id]?.maxStack) || 64);
      const capacity = current
        ? (stacksEqual(current, moving) ? Math.max(0, max - current.count) : 0)
        : max;
      const amount = Math.min(remaining, capacity);
      if (amount <= 0) continue;

      if (current) current.count += amount;
      else this._setSlotStack(target.kind, target.index, { ...moving, count: amount });
      remaining -= amount;
      changed = true;
    }

    if (!changed) return false;
    this._setSlotStack(sourceKind, sourceIndex, remaining > 0 ? { ...original, count: remaining } : null);
    this.refreshInventory();
    if (this.containerSession && this.cb.onContainerChange) {
      this.cb.onContainerChange(this.containerSession.state, this.containerSession.type, -1);
    }
    return true;
  }

  _slotClick(kind, index, button = 0) {
    if (kind === 'result') {
      if (button === 0 || button === 2) this._takeCraftResult(button);
      return;
    }
    if (kind === 'container') {
      this._containerSlotClick(index, button);
      return;
    }
    if (this.singleTransferMode) {
      if (button === 0) {
        if (kind === 'inv') this._selectTransferSource(index);
        else if (kind === 'craft') this._transferOneToCraft(index);
      }
      return;
    }
    if (!this._handleStackSlotClick(kind, index, button)) return;
    this.refreshInventory();
    if (this.containerSession && kind === 'inv' && this.cb.onContainerChange) {
      this.cb.onContainerChange(this.containerSession.state, this.containerSession.type, index);
    }
  }

  _takeCraftResult(button = 0) {
    const result = this.craftRemainder || matchRecipe(this.craftGrid);
    if (!result) return false;
    const rightClick = button === 2;
    const outputCount = rightClick ? 1 : result.count;
    const maxStack = Math.max(1, Number(BLOCKS[result.id]?.maxStack) || 64);
    if (outputCount > maxStack) return false;
    const resultStack = makeStack(result.id, outputCount, result.dur, result.meta);
    if (!resultStack) return false;
    if (this.heldStack) {
      if (!stacksEqual(this.heldStack, resultStack)) return false;
      if (this.heldStack.count + outputCount > maxStack) return false;
    }

    if (!this.heldStack) this.heldStack = resultStack;
    else this.heldStack.count += outputCount;
    if (!this.heldStack) return false;

    if (this.craftRemainder) {
      this.craftRemainder.count -= outputCount;
      if (this.craftRemainder.count <= 0) this.craftRemainder = null;
    } else {
      this._consumeCraftIngredients();
      const uncollected = result.count - outputCount;
      if (uncollected > 0) this.craftRemainder = makeStack(result.id, uncollected, result.dur, result.meta);
      this.cb.onCraft && this.cb.onCraft(result);
    }
    this.refreshInventory();
    return true;
  }

  _returnStack(stack) {
    if (!stack) return;
    const leftover = this.inventory.add(stack.id, stack.count, stack.dur, stack.meta);
    if (leftover > 0 && this.cb.onDropStack) {
      this.cb.onDropStack(stack.id, leftover, { ...stack, count: leftover });
    }
  }

  _returnCraftGrid() {
    for (let i = 0; i < this.craftGrid.length; i++) {
      const stack = this.craftGrid[i];
      if (!stack) continue;
      this._returnStack(stack);
      this.craftGrid[i] = null;
    }
    this.refreshInventory();
  }

  _returnCraftRemainder() {
    if (!this.craftRemainder) return;
    this._returnStack(this.craftRemainder);
    this.craftRemainder = null;
    this.refreshInventory();
  }

  _dropHeld() {
    if (!this.heldStack) return;
    this._returnStack(this.heldStack);
    this.heldStack = null;
    this.refreshInventory();
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
    for (let i = 0; i < this.craftSlotEls.length; i++) {
      this._drawSlot(this.craftSlotEls[i], i < this.craftGrid.length ? this.craftGrid[i] : null);
    }
    for (const slotName of EQUIPMENT_SLOTS) {
      this._drawSlot(this.equipmentSlotEls?.[slotName], this.inventory.getEquipment(slotName));
    }
    this._drawSlot(this.resultSlotEl, this._getSlotStack('result', 0));

    this._refreshContainerUI();

    if (this.transferStatus) {
      const selectedSource = this.transferSourceIndex >= 0
        ? this.inventory.getSlot(this.transferSourceIndex)
        : null;
      if (!this.singleTransferMode) {
        this.transferStatus.textContent = `Ein Item pro Tipp: Modus starten, Inventar-Slot wählen, dann ein ${this.craftingMode === 'workbench' ? '3×3' : '2×2'}-Crafting-Feld antippen.`;
      } else if (!selectedSource) {
        this.transferStatus.textContent = `Modus an: Tippe einen belegten Inventar-Slot an; danach ein ${this.craftingMode === 'workbench' ? '3×3' : '2×2'}-Feld. Pro Tipp wandert 1 Item.`;
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
        <li><b>Rucksack:</b> 2×2-Spielercrafting; Werkbänke öffnen das 3×3-Feld. Items antippen oder ziehen.</li>
        <li><b>Ausrüstung:</b> Die Nebenhand ist nutzbar; Rüstungsslots akzeptieren nur passende, im Spiel definierte Rüstungsitems.</li>
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
        <li><b>Im Inventar:</b> Linksklick nimmt/legt Stapel; Rechtsklick nimmt die Hälfte oder legt 1 Item. Ziehen verteilt, Shift-Klick sortiert zwischen Hotbar und Inventar.</li>
        <li><b>Crafting:</b> Das Spielerraster ist 2×2, Werkbänke bieten 3×3. Rechtsklick nimmt ein Ergebnis; Shift-Klick craftet so viel wie möglich.</li>
        <li><b>Tooltips & Ausrüstung:</b> Über Items fahren; Nebenhand und definierte Ausrüstung werden gespeichert.</li>
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
