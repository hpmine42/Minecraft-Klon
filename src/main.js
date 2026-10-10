// main.js — Spielverkabelung: Zustände, Hauptschleife, Steuerung, Speichern.
import * as THREE from '../lib/three.module.js';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { TouchControls, isTouchDevice } from './core/touch.js';
import { AudioEngine } from './core/audio.js';
import { createAtlasCanvas, drawTileIcon } from './world/textures.js';
import { World, SEA_LEVEL } from './world/world.js';
import { BLOCKS, BLOCK, getName, TOOL, isPlaceable } from './world/blocks.js';
import { Player, PHYS } from './player/player.js';
import { Inventory, matchRecipe, HOTBAR_SIZE } from './player/inventory.js';
import { Interaction } from './player/interaction.js';
import { MobManager } from './entities/mobs.js';
import { ParticleSystem } from './entities/particles.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { DebugOverlay } from './ui/debug.js';
import { runSelfTest, renderSelfTest } from './ui/selftest.js';
import {
  saveGame, loadGame, hasSave, deleteSave,
  saveSettings, loadSettings, defaultSettings,
} from './save/storage.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.state = 'boot'; // boot | menu | loading | playing | paused | inventory | dead
    this.isTouch = isTouchDevice();
    this.settings = { ...defaultSettings(this.isTouch), ...(loadSettings() || {}) };
    this.timeOfDay = 0.22;
    this.weather = 'clear'; // clear | rain
    this.weatherTimer = 90 + Math.random() * 180;
    this.rainStrength = 0;
    this.autosaveTimer = 0;
    this.lastFrame = 0;
    this.doubleJumpTimer = 0;
    this.stats = { blocksPlaced: 0, blocksMined: 0, mobsKilled: 0, itemsPicked: 0, distance: 0 };
    this.lastSavePos = null;
  }

  // =========================================================================
  // Boot
  // =========================================================================
  boot() {
    this.canvas = $('game');
    this.engine = new Engine(this.canvas, {
      fov: this.settings.fov,
      antialias: !this.isTouch,
      maxPixelRatio: this.isTouch ? 1.75 : 2,
    });
    this.atlasCanvas = createAtlasCanvas(1337);
    this._applyAtlas();

    this.audio = new AudioEngine();
    this.audio.setVolume(this.settings.volume);

    this.inventory = new Inventory();
    this.player = new Player(null);

    this.input = new Input(this.canvas);
    this.input.sensitivity = this.settings.sensitivity;
    this.input.onPause = () => {
      // Pointer-Lock verloren → Pause öffnen (nur wenn gerade gespielt wird)
      if (this.state === 'playing' && !this.isTouch) this.pause();
    };

    this.touch = this.isTouch ? new TouchControls({
      joystickZone: $('joystick-zone'),
      joystickKnob: $('joystick-knob'),
      lookZone: $('look-zone'),
      btnJump: $('btn-jump'),
      btnSneak: $('btn-sneak'),
      btnFly: $('btn-fly'),
      btnAttack: $('btn-attack'),
      btnPlace: $('btn-place'),
      btnInventory: $('btn-inventory'),
      btnCraft: $('btn-craft'),
      btnMenu: $('btn-menu'),
      btnDebug: $('btn-debug'),
    }, {
      sensitivity: this.settings.sensitivity,
      onAction: (name) => this._touchAction(name),
    }) : null;

    this.hud = new HUD({
      hotbar: $('hotbar'),
      hearts: $('hearts'),
      hunger: $('hunger'),
      air: $('air'),
      itemName: $('item-name'),
      breakProgress: $('break-progress'),
      fps: $('fps'),
      hurtOverlay: $('hurt-overlay'),
      waterOverlay: $('water-overlay'),
      modeLabel: $('mode-label'),
    }, this.atlasCanvas, this.inventory);
    this.hud.onSelect = (i) => {
      const s = this.inventory.slots[i];
      if (s) this.hud.showItemName(getName(s.id));
    };

    this.menus = new Menus({
      'main-menu': $('main-menu'),
      'pause-menu': $('pause-menu'),
      'settings-screen': $('settings-screen'),
      'inventory-screen': $('inventory-screen'),
      'death-screen': $('death-screen'),
      'help-screen': $('help-screen'),
      'loading-screen': $('loading-screen'),
      'selftest-screen': $('selftest-screen'),
      'inventory-body': $('inventory-body'),
      'btn-close-inventory': $('btn-close-inventory'),
      'loading-text': $('loading-text'),
      'death-stats': $('death-stats'),
      'help-content': $('help-content'),
      'btn-play': $('btn-play'),
      'btn-new-world': $('btn-new-world'),
      'btn-resume': $('btn-resume'),
      'btn-open-settings': $('btn-open-settings'),
      'btn-settings-back': $('btn-settings-back'),
      'btn-settings-from-pause': $('btn-settings-from-pause'),
      'btn-save': $('btn-save'),
      'btn-quit': $('btn-quit'),
      'btn-respawn': $('btn-respawn'),
      'btn-help': $('btn-help'),
      'btn-help-back': $('btn-help-back'),
      'btn-selftest': $('btn-selftest'),
      'btn-reset-world': $('btn-reset-world'),
      'btn-delete-save': $('btn-delete-save'),
      'btn-selftest-back': $('btn-selftest-back'),
      'selftest-results': $('selftest-results'),
      'setting-render-distance': $('setting-render-distance'),
      'setting-fov': $('setting-fov'),
      'setting-sensitivity': $('setting-sensitivity'),
      'setting-volume': $('setting-volume'),
      'setting-day-length': $('setting-day-length'),
      'setting-particles': $('setting-particles'),
      'setting-invert-y': $('setting-invert-y'),
      'setting-debug': $('setting-debug'),
      'setting-autosave': $('setting-autosave'),
    }, this.atlasCanvas, this.inventory, {
      onPlay: () => this.continueGame(),
      onNewWorld: () => this.startNewWorld(),
      onResume: () => this.resume(),
      onSave: () => { this.saveNow(); this.toast('Spiel gespeichert!'); },
      onQuit: () => { this.saveNow(); this.quitToMenu(); },
      onRespawn: () => this.respawn(),
      onSettingsChange: (key, value) => this.applySetting(key, value),
      onResetWorld: () => { deleteSave(); this.startNewWorld(); },
      onDeleteSave: () => { deleteSave(); this.menus.setHasSave(false); this.toast('Spielstand gelöscht'); },
      onCloseInventory: () => this.closeInventory(),
      onCraft: () => this.audio.craft(),
      onDropStack: (id, count) => this._dropItems(id, count),
      onSelfTest: () => this.runSelfTest(),
    });
    this.menus.setSettings(this.settings);
    this.menus.setHasSave(hasSave());
    this.menus.populateHelp(this.isTouch);

    this.debug = new DebugOverlay($('debug'));

    // Globale Events
    window.addEventListener('keydown', (e) => this._onKey(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    this.canvas.addEventListener('click', () => {
      this.audio.init();
      if (this.state === 'playing' && !this.isTouch && !this.input.locked) {
        this.input.lock();
      }
    });
    // Audio bei erster Interaktion initialisieren
    const initAudio = () => { this.audio.init(); };
    window.addEventListener('pointerdown', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });

    // Sichtbarkeitswechsel → Auto-Speichern / Pause
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') {
        this.saveNow();
      }
    });

    // Mobile-UI ein-/ausblenden
    $('mobile-controls').style.display = this.isTouch ? 'block' : 'none';

    this.menus.showScreen('main-menu');
    this.state = 'menu';

    // Hauptschleife starten
    requestAnimationFrame((t) => this._loop(t));
  }

  _applyAtlas() {
    const tex = new THREE.CanvasTexture(this.atlasCanvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.atlasTexture = tex;

    const solid = new THREE.MeshBasicMaterial({
      map: tex,
      vertexColors: true,
    });
    const transparent = new THREE.MeshBasicMaterial({
      map: tex,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
    });
    const fluidWater = new THREE.MeshBasicMaterial({
      map: this.engine.waterTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fluidLava = new THREE.MeshBasicMaterial({
      map: this.engine.lavaTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials = {
      solid, transparent, fluidWater, fluidLava,
      scene: this.engine.scene,
    };
  }

  // =========================================================================
  // Weltverwaltung
  // =========================================================================
  startNewWorld() {
    const seedInput = $('seed-input');
    const seedStr = seedInput && seedInput.value.trim()
      ? seedInput.value.trim()
      : String(Math.floor(Math.random() * 1e9));
    const worldTypeSel = $('world-type');
    const modeSel = $('game-mode');
    const peacefulChk = $('peaceful-mode');

    const worldType = worldTypeSel ? worldTypeSel.value : 'normal';
    const gamemode = modeSel ? modeSel.value : 'survival';
    const peaceful = peacefulChk ? peacefulChk.checked : true;

    let seed = 0;
    if (/^\d+$/.test(seedStr)) seed = parseInt(seedStr, 10) >>> 0;
    else {
      // String-Seed hashen
      for (let i = 0; i < seedStr.length; i++) {
        seed = (Math.imul(seed, 31) + seedStr.charCodeAt(i)) >>> 0;
      }
    }

    this.menus.setLoading('Welt wird generiert…');
    this.state = 'loading';

    // Kurze Pause, damit das Loading-Overlay erscheint
    setTimeout(() => {
      this._initWorld(seed, worldType);
      const spawn = this.world.gen.findSpawn();
      this.player.world = this.world;
      this.player.teleport(spawn.x, spawn.y, spawn.z);
      this.player.yaw = Math.PI;
      this.player.pitch = 0;
      this.player.gamemode = gamemode;
      this.player.peaceful = peaceful;
      this.player.health = 20;
      this.player.hunger = 20;
      this.player.dead = false;
      this.timeOfDay = 0.22;
      this.weather = 'clear';
      this.weatherTimer = 90 + Math.random() * 180;

      // Start-Ausrüstung
      this.inventory.slots.fill(null);
      if (gamemode === 'creative') {
        const kit = [
          BLOCK.GRASS, BLOCK.STONE, BLOCK.COBBLESTONE, BLOCK.PLANKS, BLOCK.LOG,
          BLOCK.GLASS, BLOCK.TORCH, BLOCK.DIAMOND_PICKAXE, BLOCK.DIAMOND_SWORD,
        ];
        kit.forEach((id, i) => { this.inventory.slots[i] = { id, count: 64, dur: BLOCKS[id]?.durability || null }; });
      } else {
        this.inventory.slots[0] = { id: BLOCK.WOOD_SWORD, count: 1, dur: 60 };
        this.inventory.slots[1] = { id: BLOCK.BREAD, count: 3, dur: null };
      }

      // Chunks vorladen (Spawn-Umgebung)
      for (let i = 0; i < 3; i++) {
        this.world.update(this.player.position.x, this.player.position.z, Math.min(2, this.settings.renderDistance), 40, Infinity);
      }

      this.state = 'playing';
      this.menus.hideAll();
      if (!this.isTouch) this.input.lock();
      this.toast('Willkommen! Viel Spaß beim Bauen.');
    }, 60);
  }

  continueGame() {
    const data = loadGame();
    if (!data) {
      this.startNewWorld();
      return;
    }
    this.menus.setLoading('Spielstand wird geladen…');
    this.state = 'loading';
    setTimeout(() => {
      this._initWorld(data.seed, data.worldType || 'normal');
      this.player.world = this.world;
      this.player.fromJSON(data.player);
      this.inventory.fromJSON(data.inventory);
      this.timeOfDay = data.timeOfDay ?? 0.22;
      this.weather = data.weather || 'clear';
      this.weatherTimer = data.weatherTimer ?? 120;
      if (data.stats) this.stats = { ...this.stats, ...data.stats };

      if (!this.world.gen.heightAt) {
        // Sicherheit
      }
      // Falls keine Position: Spawn suchen
      if (!data.player || !data.player.position) {
        const spawn = this.world.gen.findSpawn();
        this.player.teleport(spawn.x, spawn.y, spawn.z);
      }

      for (let i = 0; i < 3; i++) {
        this.world.update(this.player.position.x, this.player.position.z, Math.min(2, this.settings.renderDistance), 40, Infinity);
      }
      this.state = 'playing';
      this.menus.hideAll();
      if (!this.isTouch) this.input.lock();
      this.toast('Spielstand geladen.');
    }, 60);
  }

  _initWorld(seed, worldType) {
    // Alte Welt aufräumen
    if (this.world) {
      for (const chunk of this.world.chunks.values()) {
        this.world.disposeChunkMeshes(chunk);
      }
    }
    if (this.mobs) this.mobs.clear();
    if (this.particles) this.particles.clear();

    this.world = new World(seed, worldType, this.materials);
    // Gespeicherte Änderungen laden (werden bei Generierung angewendet)
    const saved = loadGame();
    if (saved && saved.seed === seed && Array.isArray(saved.modified)) {
      for (const entry of saved.modified) {
        const [x, y, z] = entry.pos.split(',').map(Number);
        this.world.modified.set(entry.pos, { id: entry.id, meta: entry.meta || 0 });
      }
    }

    this.mobs = new MobManager(this.engine.scene, this.world);
    this.particles = new ParticleSystem(this.engine.scene);
    this.interaction = new Interaction(this.world, this.player, this.inventory, this.mobs, this.particles, this.audio);
  }

  saveNow() {
    if (!this.world || !this.player || this.state === 'menu') return false;
    const ok = saveGame(this.world, this.player, this.inventory, {
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      weatherTimer: this.weatherTimer,
      stats: this.stats,
    });
    if (ok) this.menus.setHasSave(true);
    return ok;
  }

  quitToMenu() {
    this.state = 'menu';
    if (this.input.locked) this.input.unlock();
    this.menus.showScreen('main-menu');
    this.menus.setHasSave(hasSave());
    if (this.mobs) this.mobs.clear();
    if (this.particles) this.particles.clear();
  }

  respawn() {
    const spawn = this.world.gen.findSpawn();
    this.player.respawn(spawn);
    this.state = 'playing';
    this.menus.hideAll();
    if (!this.isTouch) this.input.lock();
    this.toast('Wiederbelebt!');
  }

  // =========================================================================
  // Zustandswechsel
  // =========================================================================
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (this.input.locked) this.input.unlock();
    this.menus.showScreen('pause-menu');
    this.saveNow();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.menus.hideAll();
    if (!this.isTouch) this.input.lock();
  }

  openInventory() {
    if (this.state !== 'playing') return;
    this.state = 'inventory';
    if (this.input.locked) this.input.unlock();
    this.menus.showScreen('inventory-screen');
  }

  closeInventory() {
    if (this.state !== 'inventory') return;
    this.state = 'playing';
    this.menus.hideAll();
    if (!this.isTouch) this.input.lock();
    // Hotbar-Update erzwingen
    this.hud.update(0, this.player);
    this.hud._lastSig = null;
  }

  async runSelfTest() {
    this.menus.showScreen('selftest-screen');
    const resultsEl = $('selftest-results');
    if (resultsEl) resultsEl.innerHTML = '<p>Diagnose läuft…</p>';
    try {
      const report = await runSelfTest(this);
      if (resultsEl) renderSelfTest(resultsEl, report);
    } catch (e) {
      if (resultsEl) resultsEl.innerHTML = `<p>Fehler: ${e.message}</p>`;
    }
    const back = $('btn-selftest-back');
    if (back && !back._bound) {
      back._bound = true;
      back.addEventListener('click', () => {
        this.menus.showScreen(this.state === 'playing' ? null : 'main-menu');
      });
    }
  }

  // =========================================================================
  // Einstellungen
  // =========================================================================
  applySetting(key, value) {
    this.settings[key] = value;
    switch (key) {
      case 'renderDistance':
        // Wird im Loop berücksichtigt
        break;
      case 'fov':
        this.engine.setFov(value);
        break;
      case 'sensitivity':
        this.input.sensitivity = value;
        if (this.touch) this.touch.sensitivity = value;
        break;
      case 'volume':
        this.audio.setVolume(value);
        break;
      case 'showDebug':
        if (this.debug) {
          if (value && !this.debug.visible) this.debug.toggle();
          if (!value && this.debug.visible) this.debug.toggle();
        }
        break;
      default:
        break;
    }
    saveSettings(this.settings);
  }

  // =========================================================================
  // Tastatur
  // =========================================================================
  _onKey(e) {
    if (this.state === 'menu' || this.state === 'loading') return;

    switch (e.code) {
      case 'Escape':
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        else if (this.state === 'inventory') this.closeInventory();
        break;
      case 'KeyE':
        if (this.state === 'playing') this.openInventory();
        else if (this.state === 'inventory') this.closeInventory();
        break;
      case 'KeyF':
        if (this.state === 'playing' && this.player.gamemode === 'creative') {
          this.player.flying = !this.player.flying;
          this.toast(this.player.flying ? 'Fliegen: AN' : 'Fliegen: AUS');
        }
        break;
      case 'F3':
        e.preventDefault();
        this.debug.toggle();
        break;
      case 'KeyM':
        if (this.state === 'playing') {
          this.player.gamemode = this.player.gamemode === 'survival' ? 'creative' : 'survival';
          if (this.player.gamemode === 'survival') this.player.flying = false;
          this.hud.setGamemodeLabel(this.player.gamemode, this.player.peaceful);
          this.toast(`Modus: ${this.player.gamemode}`);
        }
        break;
      case 'KeyP':
        if (this.state === 'playing') {
          this.player.peaceful = !this.player.peaceful;
          this.hud.setGamemodeLabel(this.player.gamemode, this.player.peaceful);
          this.toast(this.player.peaceful ? 'Friedlich: AN' : 'Friedlich: AUS');
        }
        break;
      case 'KeyT':
        if (this.state === 'playing') {
          // Zur nächsten Tageszeit springen
          const t = this.timeOfDay;
          if (t < 0.25) this.timeOfDay = 0.25;
          else if (t < 0.5) this.timeOfDay = 0.72;
          else if (t < 0.75) this.timeOfDay = 0.75;
          else this.timeOfDay = 0.22;
          this.toast('Zeit gesprungen');
        }
        break;
      case 'KeyO':
        if (this.state === 'playing') {
          this.weather = this.weather === 'clear' ? 'rain' : 'clear';
          this.toast(this.weather === 'rain' ? 'Es regnet…' : 'Der Himmel klärt sich');
        }
        break;
      case 'F5':
        e.preventDefault();
        if (this.state === 'playing' || this.state === 'paused') {
          this.saveNow();
          this.toast('Gespeichert!');
        }
        break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
      case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
        if (this.state === 'playing') {
          this.inventory.selected = parseInt(e.code.slice(5), 10) - 1;
          const s = this.inventory.slots[this.inventory.selected];
          if (s) this.hud.showItemName(getName(s.id));
          this.hud._lastSig = null;
        }
        break;
      case 'Space':
        if (this.state === 'playing') {
          // Doppelsprung → Fliegen
          const now = performance.now();
          if (now - this.doubleJumpTimer < 320 && this.player.gamemode === 'creative') {
            this.player.flying = !this.player.flying;
            this.toast(this.player.flying ? 'Fliegen: AN' : 'Fliegen: AUS');
          }
          this.doubleJumpTimer = now;
        }
        break;
      default:
        break;
    }
  }

  _onKeyUp(e) {
    // Derzeit nichts
  }

  _touchAction(name) {
    switch (name) {
      case 'inventory':
        if (this.state === 'playing') this.openInventory();
        else if (this.state === 'inventory') this.closeInventory();
        break;
      case 'menu':
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        break;
      case 'fly':
        if (this.state === 'playing' && this.player.gamemode === 'creative') {
          this.player.flying = !this.player.flying;
          this.toast(this.player.flying ? 'Fliegen: AN' : 'Fliegen: AUS');
        }
        break;
      case 'doubleJump':
        if (this.state === 'playing' && this.player.gamemode === 'creative') {
          this.player.flying = !this.player.flying;
          this.toast(this.player.flying ? 'Fliegen: AN' : 'Fliegen: AUS');
        }
        break;
      case 'debug':
        this.debug.toggle();
        break;
      case 'sneak':
        this.toast(this.touch.sneak ? 'Schleichen: AN' : 'Schleichen: AUS');
        break;
      default:
        break;
    }
  }

  // =========================================================================
  // Hauptschleife
  // =========================================================================
  _loop(time) {
    requestAnimationFrame((t) => this._loop(t));
    const dt = Math.min(0.05, (time - this.lastFrame) / 1000 || 0.016);
    this.lastFrame = time;

    if (this.state === 'playing' || this.state === 'inventory' || this.state === 'paused' || this.state === 'dead') {
      if (this.state === 'playing') {
        this._updatePlaying(dt);
      }
      // Rendering auch im Pause-Menü (Hintergrund bleibt sichtbar)
      this.engine.updateSky(this.timeOfDay, this.settings.renderDistance, dt, this.rainStrength);
      this.engine.updateFov(this.player.sprinting, dt);
      this.engine.render();
    }
  }

  _updatePlaying(dt) {
    const player = this.player;

    // ---- Eingaben ---------------------------------------------------------
    let moveInput;
    let lookDX = 0;
    let lookDY = 0;
    let pressed;

    if (this.isTouch && this.touch) {
      moveInput = this.touch.movement();
      const look = this.touch.consumeLook();
      lookDX = look.x;
      lookDY = look.y;
      pressed = this.touch.consumePressed();
    } else {
      moveInput = this.input.movement();
      const mouse = this.input.consumeMouse();
      lookDX = mouse.dx;
      lookDY = mouse.dy;
      pressed = this.input.consumePressed();
      const wheel = this.input.consumeWheel();
      if (wheel !== 0) {
        this.inventory.selected = ((this.inventory.selected + wheel) % 9 + 9) % 9;
        this.hud._lastSig = null;
      }
    }

    // Blick drehen
    const invert = this.settings.invertY ? -1 : 1;
    player.yaw -= lookDX;
    player.pitch -= lookDY * invert;
    const maxPitch = Math.PI / 2 - 0.01;
    player.pitch = Math.max(-maxPitch, Math.min(maxPitch, player.pitch));

    // ---- Physik -----------------------------------------------------------
    const oldPos = { ...player.position };
    player.update(dt, moveInput);
    this.stats.distance += Math.hypot(player.position.x - oldPos.x, player.position.z - oldPos.z);

    // Schritte & Landung
    const onGround = player.onGround;
    const hSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (onGround && hSpeed > 1.2 && player.walkTime % 1 < 0.5) {
      const under = this.world.getBlock(
        Math.floor(player.position.x),
        Math.floor(player.position.y - 0.2),
        Math.floor(player.position.z)
      );
      const mat = under === BLOCK.STONE || under === BLOCK.COBBLESTONE ? 'stone'
        : under === BLOCK.SAND ? 'sand'
        : under === BLOCK.LOG || under === BLOCK.PLANKS ? 'wood' : 'grass';
      this.audio.step(mat);
    }
    if (player.justLanded) {
      if (player.justLanded > 1) this.audio.land();
      player.justLanded = 0;
    }
    if (moveInput.jump && onGround && !player._jumpSoundPlayed) {
      this.audio.jump();
      player._jumpSoundPlayed = true;
    }
    if (!moveInput.jump) player._jumpSoundPlayed = false;

    // Schaden-Sound + HUD-Flash
    if (player.hurtTime > 0.3) {
      this.audio.hurt();
      this.hud.flashHurt();
      player.hurtTime = 0.25;
    }

    // ---- Tageszeit & Wetter -----------------------------------------------
    const dayLen = this.settings.dayLength;
    if (dayLen > 0) {
      this.timeOfDay = (this.timeOfDay + dt / dayLen) % 1;
    }
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 120 + Math.random() * 240;
      this.weather = Math.random() < 0.35 ? 'rain' : 'clear';
    }
    const targetRain = this.weather === 'rain' ? 1 : 0;
    this.rainStrength += (targetRain - this.rainStrength) * Math.min(1, dt * 0.6);
    if (this.weather === 'rain' && this.rainStrength > 0.2) {
      if (Math.random() < dt * 0.5) this.audio.startRain();
    } else {
      this.audio.stopRain();
    }

    // ---- Welt aktualisieren -------------------------------------------------
    const built = this.world.update(
      player.position.x,
      player.position.z,
      this.settings.renderDistance,
      this.isTouch ? 5 : 8
    );

    // Zufalls-Tick: Weizen wachsen lassen
    this._cropTick(dt);

    // ---- Interaktion --------------------------------------------------------
    let usePressed = pressed.use || false;
    // Werkbank/Truhe anklicken öffnet das Inventar
    if (usePressed) {
      const hit = this.world.raycast(player.eyePosition(), player.lookDir(), 5.2);
      if (hit && (hit.id === BLOCK.CRAFTING_TABLE || hit.id === BLOCK.CHEST || hit.id === BLOCK.FURNACE)) {
        this.openInventory();
        usePressed = false;
      }
    }

    const attackHeld = this.isTouch
      ? (this.touch.attack || pressed.attack)
      : (this.input.attack);

    this.interaction.update(dt, {
      attack: attackHeld,
      usePressed,
      pickPressed: pressed.pick || false,
    }, this.engine.camera);

    // ---- Mobs & Partikel ----------------------------------------------------
    this.mobs.update(dt, player, this.inventory, {
      onPlayerHurt: () => {
        this.hud.flashHurt();
        this.audio.hurt();
      },
      onPickup: (id, count) => {
        this.audio.pickup();
        this.hud.showItemName(`+${count} ${getName(id)}`);
        this.stats.itemsPicked += count;
      },
      onMobBurn: (mob) => {
        if (Math.random() < dt * 10) {
          this.particles.flame(mob.position.x, mob.position.y + 1, mob.position.z, 1);
        }
      },
    }, this.timeOfDay);

    // Mob-Töne gelegentlich
    if (Math.random() < dt * 0.12) {
      const near = this.mobs.mobs.filter((m) => {
        const d = Math.hypot(m.position.x - player.position.x, m.position.z - player.position.z);
        return d < 18;
      });
      if (near.length > 0) {
        const mob = near[Math.floor(Math.random() * near.length)];
        const type = mob.type || (mob instanceof Object && mob.passive === false ? 'zombie' : null);
        if (type === 'zombie' || mob.passive === false) this.audio.zombie();
        else if (type && this.audio[type]) this.audio[type]();
      }
    }

    this.particles.update(dt);

    // Unterwasser-Overlay
    const underwater = player.headInWater;
    this.engine.underwater = underwater;
    this.hud.setUnderwater(underwater);

    // Fackel-Partikel (nahe Blöcke im Blickfeld? – nah am Spieler)
    if (Math.random() < dt * 2.5) {
      const px = Math.floor(player.position.x);
      const py = Math.floor(player.position.y);
      const pz = Math.floor(player.position.z);
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          for (let dy = -1; dy <= 3; dy++) {
            if (this.world.getBlock(px + dx, py + dy, pz + dz) === BLOCK.TORCH) {
              if (Math.random() < 0.3) {
                this.particles.smoke(px + dx + 0.5, py + dy + 0.75, pz + dz + 0.5, 1);
              }
              break;
            }
          }
        }
      }
    }

    // ---- Kamera -------------------------------------------------------------
    const eye = player.eyePosition();
    // leichtes Kopf-Bobbing beim Gehen
    const bobAmp = player.onGround && hSpeed > 1 ? Math.min(0.045, hSpeed * 0.008) : 0;
    const bob = Math.sin(player.walkTime * 3.5) * bobAmp;
    this.engine.camera.position.set(eye.x, eye.y + bob, eye.z);
    this.engine.camera.rotation.order = 'YXZ';
    this.engine.camera.rotation.set(player.pitch, player.yaw, 0);

    // ---- HUD -----------------------------------------------------------------
    this.hud.update(dt, player);
    this.hud.updateFPS(dt);
    this.hud.setBreakProgress(this.interaction.breakFraction);
    this.hud.setGamemodeLabel(player.gamemode, player.peaceful);

    this.debug.update(player, this.world, this.hud.fps, this.mobs, {
      time: this.timeOfDay,
      weather: this.weather,
      device: this.isTouch
        ? `Touch: ${window.innerWidth}×${window.innerHeight}`
        : `Desktop ${window.innerWidth}×${window.innerHeight}`,
    });

    // ---- Tod -----------------------------------------------------------------
    if (player.dead && this.state === 'playing') {
      this.state = 'dead';
      if (this.input.locked) this.input.unlock();
      const mins = Math.floor(this.stats.distance / 60);
      this.menus.setDeathScreen({
        text: `Gelaufen: ${Math.floor(this.stats.distance)} Blöcke · Blöcke abgebaut: ${this.stats.blocksMined} · Mobs besiegt: ${this.stats.mobsKilled}`,
      });
    }

    // ---- Auto-Speichern -------------------------------------------------------
    if (this.settings.autosave !== false) {
      this.autosaveTimer += dt;
      if (this.autosaveTimer > (this.settings.autosaveInterval || 60)) {
        this.autosaveTimer = 0;
        this.saveNow();
      }
    }
  }

  /** Weizen-Wachstum (Zufalls-Tick). */
  _cropTick(dt) {
    this._cropTimer = (this._cropTimer || 0) + dt;
    if (this._cropTimer < 8) return;
    this._cropTimer = 0;
    const p = this.player.position;
    const px = Math.floor(p.x);
    const pz = Math.floor(p.z);
    for (let i = 0; i < 24; i++) {
      const x = px + Math.floor((Math.random() - 0.5) * 32);
      const z = pz + Math.floor((Math.random() - 0.5) * 32);
      const y = this.world.heightAt(x, z) + 1;
      if (this.world.getBlock(x, y, z) === BLOCK.WHEAT) {
        const stage = this.world.getMeta(x, y, z);
        if (stage < 3) {
          this.world.setBlock(x, y, z, BLOCK.WHEAT, stage + 1);
        }
      }
    }
  }

  _dropItems(id, count) {
    // ItemEntities vor dem Spieler spawnen (wenn Inventar voll ist)
    if (!this.mobs) return;
    const p = this.player.position;
    const dir = this.player.lookDir();
    // Import hier vermeiden – ItemEntity wird über mobs.spawnDrops genutzt
    this.mobs.spawnDrops(p.x + dir.x, p.y + 0.5, p.z + dir.z, [{ id, count }]);
  }

  toast(text) {
    this.hud.showItemName(text);
  }
}

// ===========================================================================
// Start
// ===========================================================================
const game = new Game();
let booted = false;
function bootOnce() {
  if (booted) return;
  booted = true;
  game.boot();
}
window.addEventListener('DOMContentLoaded', bootOnce);
if (document.readyState !== 'loading') {
  bootOnce();
}
window.__game = game;
