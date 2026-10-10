// storage.js — Spielstände in localStorage speichern/laden.
const SAVE_KEY = 'minecraft-klon-save-v1';
const SETTINGS_KEY = 'minecraft-klon-settings-v1';

export function saveGame(world, player, inventory, extra = {}) {
  try {
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      seed: world.seed,
      worldType: world.worldType,
      modified: [...world.modified.entries()].map(([pos, val]) => ({ pos, ...val })),
      player: player.toJSON(),
      inventory: inventory.toJSON(),
      timeOfDay: extra.timeOfDay ?? 0.25,
      weather: extra.weather ?? 'clear',
      weatherTimer: extra.weatherTimer ?? 60,
      stats: extra.stats ?? {},
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Speichern fehlgeschlagen:', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    console.warn('Laden fehlgeschlagen:', e);
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/** Standard-Einstellungen (gerätabhängig). */
export function defaultSettings(isMobile) {
  return {
    renderDistance: isMobile ? 3 : 6,
    fov: isMobile ? 70 : 75,
    sensitivity: isMobile ? 0.0042 : 0.0022,
    volume: 0.7,
    dayLength: 480,           // Sekunden pro Tag
    showDebug: false,
    invertY: false,
    autosaveInterval: 60,
    particles: isMobile ? 'low' : 'high',
  };
}
