# Minecraft-Klon 🌍⛏️

Ein umfangreicher Minecraft-Klon für **Computer und Handy** – komplett im Browser,
ohne Installation, mit prozeduraler Welt, Tag/Nacht-Zyklus, Mobs, Crafting, Viehzucht,
Höhlen, Erzen und vielem mehr.

![Plattform](https://img.shields.io/badge/Plattform-PC%20%2B%20Handy-brightgreen)
![Technik](https://img.shields.io/badge/Technik-Three.js%20%2B%20WebGL-blue)

## 🚀 Starten

```bash
npm start          # startet den Webserver auf Port 8080
# → im Browser öffnen: http://localhost:8080
```

Ohne Node.js geht es auch mit jedem anderen statischen Webserver, z. B.:

```bash
python3 -m http.server 8080
```

**Fürs Handy:** Öffne die URL einfach im Handy-Browser (gleiches Netzwerk wie der
Rechner, z. B. `http://192.168.x.x:8080`). Die Touch-Steuerung erscheint automatisch.
Über Arena-Preview läuft das Spiel direkt unter der bereitgestellten URL.

## ✨ Features

### Welt
- 🏔️ **Prozedurale Welt** mit unendlicher Ausdehnung (Chunk-System, 16×16×64)
- 🌲 **8 Biome**: Ebene, Wald, Wüste, Berge, Schneefläche, Sumpf, Strand, Ozean
- 🕳️ **Höhlen & Kavernen** (3D-Noise), tief absteigend
- ⛏️ **Erze**: Kohle, Eisen, Gold, Diamant, Redstone – tiefenabhängig verteilt
- 🌳 **Bäume**: Eiche, Birke, Fichte + Kakteen, Zuckerrohr, Blumen, hohes Gras
- 🌊 **Wasser & Lava** mit Animation, Schwimmen, Ertrinken, Lava-Schaden
- 🧊 Schnee, Eis, Sand (mit Schwerkraft), Lehm, Kies, Obsidian und 40+ weitere Blöcke
- 🌾 **Farming**: Hacke → Ackerboden → Samen pflanzen → Weizen wächst → Brot backen
- 🕯️ **Licht-Engine**: Himmelslicht + Fackel-Licht mit weicher Verbreitung (BFS)
- 🌅 **Tag/Nacht-Zyklus** mit Sonne, Mond, Sternen, Wolken und dynamischem Nebel
- 🌧️ **Wetter**: zyklischer Regen mit Dunkelheit, Partikeln und Sound

### Gameplay
- ⛏️ Blöcke abbauen (werkzeugabhängig, mit Fortschritt, Partikeln & Drops)
- 🧱 Blöcke platzieren, Sand/Kies fallen, Werkzeuge mit Haltbarkeit
- 🗡️ **Kampf**: Schwerter, Rückstoß, Angriffs-Cooldown, Mob-Gesundheit
- 🐷 **Tiere**: Schwein, Kuh, Schaf, Huhn – wandern, fliehen, liefern Fleisch/Leder/Wolle
- 🧟 **Nachts Zombies** – sie jagen, greifen an und verbrennen im Sonnenlicht
- 🍖 **Hunger & Gesundheit**: Essen, Verhungern, Regeneration, Fallschaden, Ertrinken
- 🎒 **Inventar** (36 Slots + Hotbar) mit Stapeln, Haltbarkeit und Touch-Bedienung
- 🔨 **Crafting**: 35+ Rezepte (Werkzeuge, Fackeln, Werkbank, Ofen, Brot, Leiter …) mit Rezeptbuch
- 🏗️ **Kreativmodus**: Fliegen, freies Bauen, Start-Ausrüstung
- 🌙 **Friedlich-Modus** ohne Monster (Standard)
- 💾 **Spielstände** (Speicher/Laden/Auto-Speichern) in localStorage
- 🎲 **Seeds**: gleicher Seed = gleiche Welt (auch als Text)
- 🏗️ **Welttypen**: Normal (Berge/Höhlen) und Flach (Bauwelt)

### Technik & Bedienung
- 📱 **Vollständige Touch-Steuerung**: virtueller Joystick, Blick-Wischen,
  Pocket-Edition-Long-Press (Block direkt unter dem Finger abbauen) plus Buttons
  (Springen, Schleichen, Fliegen, Abbauen, Platzieren, Inventar, Menü)
- 🖥️ **Desktop-Steuerung**: WASD, Maus mit Pointer-Lock, Tastenkürzel (siehe Hilfe)
- 🔊 **Prozedurale Sounds** (WebAudio) – ohne Audiodateien: Abbauen, Schritte,
  Sprünge, Tiere, Zombies, Regen, Essen, Crafting …
- 🎨 **Pixel-Art-Texturen** werden prozedural zur Laufzeit erzeugt (kein Asset-Pack nötig)
- 🧊 Ambient Occlusion & Schattierung für Tiefe
- ⚡ Performance: Chunk-Meshing mit Zeitbudget, geräteabhängige Renderdistanz,
  Pixel-Ratio-Limit, frustum culling
- 🔍 **Debug-Screen** (F3): FPS, Position, Biome, Chunk-Statistiken
- 🩺 **Selbstdiagnose** im Hauptmenü: prüft WebGL, Storage, Eingabe, Weltlogik,
  Performance – ideal zum Testen **auf dem Handy**
- ♿ Responsive UI für Hoch- und Querformat, Notch-/Safe-Area-Unterstützung

## 🎮 Steuerung

### Computer
| Taste | Funktion |
|---|---|
| WASD / Pfeile | Bewegen |
| Maus | Umsehen (Klick ins Fenster = Mauszeiger sperren) |
| Leertaste | Springen · **2× = Fliegen** (Kreativ) |
| Strg / R | Sprinten |
| Shift | Schleichen / tiefer fliegen |
| Linke Maustaste | Abbauen / angreifen (halten) |
| Rechte Maustaste | Platzieren / benutzen / essen |
| Mittlere Maustaste | Block kopieren (Kreativ) |
| Mausrad, 1–9 | Schnellleiste |
| E | Inventar & Crafting |
| Esc | Pause |
| F | Fliegen umschalten |
| F3 | Debug-Infos |
| M / P | Spielmodus / Friedlich wechseln |
| T / O | Zeit springen / Wetter umschalten |
| F5 | Sofort speichern |

### Handy
| Bedienelement | Funktion |
|---|---|
| Linker Daumen (Joystick) | Bewegen (voll = Sprint) |
| Auf Block tippen & halten | Block direkt unter dem Finger abbauen (wie Pocket Edition) |
| Wischen | Umsehen; Wischbewegungen bauen nicht ab |
| ⬆ | Springen · **2× tippen = Fliegen** |
| ⬇ | Schleichen (Umschalter) |
| 🕊 | Fliegen an/aus |
| ⛏ (halten) | Block abbauen / Mob angreifen |
| ▣ | Block platzieren / Item benutzen |
| 🎒 | Inventar & Crafting |
| ⚙ | Pause / Menü |
| Hotbar antippen | Item wählen |

## 🧪 Tests

```bash
npm test
```

Enthalten (294 Prüfungen, komplett ohne Browser lauffähig):
- **Welttests**: Noise, Blöcke, Drops, Atlas, Terrain, Licht, Raycast, Biome, Meshes
- **Spieltests**: Inventar, Crafting-Rezepte, Physik (Laufen, Springen, Kollision,
  Fallschaden, Schwimmen), Hunger, Kämpfe, Serialisierung, Speicherstände
- **Modul-Test**: alle 21 Module importierbar (Syntax & Pfade)
- **Boot-Smoke-Test (Desktop)**: kompletter Spielstart mit Stub-DOM – Weltgenerierung,
  Rendering-Pipeline, Block abbauen/platzieren, Pause/Inventar/Speichern/Laden
- **Boot-Smoke-Test (Handy)**: Spielstart im Touch-Modus – Joystick bewegt den Spieler,
  Wischen dreht den Blick, ruhiger Long-Press baut den direkt berührten Block ab,
  Sprung-/Doppelsprung-/Platzier-Buttons, Inventar & Menü, mobile Renderdistanz & Pixel-Ratio
- **Touch-Test**: Joystick-Mathematik, Look-Drag, Bildschirm-Strahl, Long-Press,
  Buttons, Doppelsprung und Touch/Maus-Doppel-Events
- **DOM-Test**: alle HTML-IDs stimmen mit dem Code überein

## 📱 Hinweise fürs Handy

1. Im **Querformat** spielen – dann passt die Steuerung am besten.
2. Bei niedriger FPS: **Renderdistanz** in den Einstellungen reduzieren
   (Handy-Standard: 3 Chunks) oder Partikel auf „Wenig" stellen.
3. Im Hauptmenü unter **„Selbstdiagnose"** finden sich Gerät, WebGL-Renderer,
   FPS und eine Systemprüfung – auf jedem Gerät einmal ausführen.
4. Der Spielstand liegt im Browser des Geräts (localStorage).

## 🗂️ Projektstruktur

```
index.html          Oberfläche (HUD, Menüs, Touch-Buttons)
styles.css          Design für Desktop & Handy
server.js           Statischer Webserver (npm start)
lib/                Three.js
src/
  main.js           Spielverkabelung & Hauptschleife
  core/             Engine (Himmel/Tag-Nacht), Eingabe, Touch, Audio
  world/            Noise, Blöcke, Texturen, Chunks/Meshing, Weltgenerierung
  player/           Physik, Inventar, Crafting, Interaktion
  entities/         Tiere, Zombies, Items, Partikel
  ui/               HUD, Menüs, Debug, Selbstdiagnose
  save/             Spielstände & Einstellungen
tests/              Node-Tests (npm test)
```

## 🧾 Technische Details

- **Rendering**: Three.js (WebGL), MeshBasicMaterial mit gebackener Beleuchtung
  (Vertex-Farben: AO + Gesichtsschattierung + Lichtlevel) für maximale Performance
- **Texturen**: 256×256 Atlas, prozedural per Canvas erzeugt (Pixel-Art),
  Wasser/Lava als animierter Frame-Streifen
- **Weltgenerator**: Perlin-Noise-fBm für Kontinente/Hügel/Berge, 3D-Noise für
  Höhlen, Biome aus Temperatur/Feuchtigkeit, deterministische Baum-Platzierung
- **Licht**: Himmelslicht (Säulen + BFS) und Blocklicht (Fackeln, Lava) pro Chunk
- **Speicherstand**: Seed + Spieler-Änderungen (Delta), dadurch klein & schnell

---

Viel Spaß beim Bauen, Erkunden und Überleben! 🏰💎
