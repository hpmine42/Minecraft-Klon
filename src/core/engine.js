// engine.js — Renderer, Szene, Himmel, Tag/Nacht, Wolken, Regen, Nebel.
import * as THREE from '../../lib/three.module.js';
import { createWaterTexture, createLavaTexture } from '../world/textures.js';

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, opts.maxPixelRatio ?? 2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: opts.antialias ?? true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if ('outputColorSpace' in this.renderer) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 75, window.innerWidth / window.innerHeight, 0.1, 600);
    this.baseFov = opts.fov ?? 75;

    // Nebel
    this.fogColor = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(this.fogColor, 40, 160);

    // ---- Himmel (Gradient-Dome) -------------------------------------------
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x3a7bd5) },
      bottomColor: { value: new THREE.Color(0x9fd3ff) },
      offset: { value: 24 },
      exponent: { value: 0.7 },
    };
    const skyGeom = new THREE.SphereGeometry(400, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          float t = max(pow(max(h, 0.0), exponent), 0.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeom, skyMat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // ---- Sonne & Mond ------------------------------------------------------
    this.sun = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshBasicMaterial({ color: 0xfff7c0, fog: false, transparent: true, depthWrite: false })
    );
    this.moon = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 22),
      new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false, transparent: true, depthWrite: false })
    );
    this.scene.add(this.sun, this.moon);

    // ---- Sterne ------------------------------------------------------------
    {
      const starCount = 700;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const v = new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 1.4 - 0.2,
          Math.random() * 2 - 1
        ).normalize().multiplyScalar(380);
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = Math.abs(v.y) * 0.9 + 10;
        positions[i * 3 + 2] = v.z;
      }
      const starGeom = new THREE.BufferGeometry();
      starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.starMaterial = new THREE.PointsMaterial({
        color: 0xffffff, size: 1.6, sizeAttenuation: false,
        transparent: true, opacity: 0, depthWrite: false, fog: false,
      });
      this.stars = new THREE.Points(starGeom, this.starMaterial);
      this.stars.frustumCulled = false;
      this.scene.add(this.stars);
    }

    // ---- Wolken ------------------------------------------------------------
    this.cloudTexture = this._makeCloudTexture();
    this.cloudMaterial = new THREE.MeshBasicMaterial({
      map: this.cloudTexture,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      fog: true,
      side: THREE.DoubleSide,
    });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), this.cloudMaterial);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 96;
    this.scene.add(this.clouds);

    // ---- Licht (für Lambert-Materialien: Mobs/Items) ------------------------
    this.hemiLight = new THREE.HemisphereLight(0xbfd8ff, 0x6b6b52, 0.9);
    this.dirLight = new THREE.DirectionalLight(0xfff2d5, 0.85);
    this.dirLight.position.set(60, 120, 40);
    this.scene.add(this.hemiLight, this.dirLight);

    // ---- Wasser/Lava-Textur (animiert) ------------------------------------
    this.waterCanvas = createWaterTexture();
    this.waterTexture = new THREE.CanvasTexture(this.waterCanvas);
    this.waterTexture.magFilter = THREE.NearestFilter;
    this.waterTexture.minFilter = THREE.NearestFilter;
    this.waterTexture.wrapS = THREE.RepeatWrapping;
    this.waterTexture.wrapT = THREE.RepeatWrapping;
    this.waterTexture.colorSpace = THREE.SRGBColorSpace;

    this.lavaCanvas = createLavaTexture();
    this.lavaTexture = new THREE.CanvasTexture(this.lavaCanvas);
    this.lavaTexture.magFilter = THREE.NearestFilter;
    this.lavaTexture.minFilter = THREE.NearestFilter;
    this.lavaTexture.wrapS = THREE.RepeatWrapping;
    this.lavaTexture.wrapT = THREE.RepeatWrapping;
    this.lavaTexture.colorSpace = THREE.SRGBColorSpace;

    // ---- Regen -------------------------------------------------------------
    this.rainIntensity = 0;
    this._rainPoints = null;
    this._buildRain();

    // State
    this.timeOfDay = 0.25;  // 0 = Sonnenaufgang, 0.25 = Mittag, 0.5 = Sonnenuntergang, 0.75 = Mitternacht
    this.underwater = false;
    this._animTime = 0;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  _makeCloudTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    // Weiche Wolkenflecken
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 18 + Math.random() * 36;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  _buildRain() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this._rainPositions = positions;
    this._rainMaterial = new THREE.PointsMaterial({
      color: 0x9db8d8, size: 0.14, transparent: true, opacity: 0,
      depthWrite: false,
    });
    this._rainPoints = new THREE.Points(geom, this._rainMaterial);
    this._rainPoints.frustumCulled = false;
    this.scene.add(this._rainPoints);
    this._rainGeom = geom;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setFov(fov) {
    this.baseFov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /** Sanfter FOV-Kick beim Sprinten. */
  updateFov(sprinting, dt) {
    const target = sprinting ? this.baseFov + 8 : this.baseFov;
    if (Math.abs(this.camera.fov - target) > 0.1) {
      this.camera.fov += (target - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }
  }

  /** Farben interpolieren. */
  static lerpColor(out, a, b, t) {
    out.r = a.r + (b.r - a.r) * t;
    out.g = a.g + (b.g - a.g) * t;
    out.b = a.b + (b.b - a.b) * t;
    return out;
  }

  /**
   * Himmel & Beleuchtung an Tageszeit anpassen.
   * @param {number} timeOfDay 0..1
   * @param {number} renderDistance aktuelle Sichtweite (Chunks) für Nebel
   */
  updateSky(timeOfDay, renderDistance, dt, raining) {
    this.timeOfDay = timeOfDay;
    this._animTime += dt;

    const t = timeOfDay;
    // Sonnenwinkel: 0 = Osten (Aufgang), 0.25 = oben, 0.5 = Westen (Untergang)
    const sunAngle = t * Math.PI * 2;
    const sunY = Math.cos(sunAngle);      // 1 = Mittag, -1 = Mitternacht
    const sunX = Math.sin(sunAngle);

    const dayFactor = Math.max(0, Math.min(1, (sunY + 0.18) / 0.5)); // 0 = Nacht, 1 = Tag
    const duskFactor = Math.max(0, 1 - Math.abs(sunY) * 3.2);        // Sonnenuntergangs-Rot

    // Himmelsfarben
    const dayTop = new THREE.Color(0x2f6fd4);
    const dayBottom = new THREE.Color(0x9fd3ff);
    const nightTop = new THREE.Color(0x060a1c);
    const nightBottom = new THREE.Color(0x101c3a);
    const duskTop = new THREE.Color(0x4a3a8c);
    const duskBottom = new THREE.Color(0xff8c42);

    const top = Engine.lerpColor(new THREE.Color(), nightTop, dayTop, dayFactor);
    const bottom = Engine.lerpColor(new THREE.Color(), nightBottom, dayBottom, dayFactor);
    if (duskFactor > 0.02) {
      top.lerp(duskTop, duskFactor * 0.55);
      bottom.lerp(duskBottom, duskFactor * 0.75);
    }
    if (raining > 0) {
      const rainGray = new THREE.Color(0x5a6a7a);
      top.lerp(rainGray, raining * 0.55);
      bottom.lerp(rainGray, raining * 0.45);
    }
    this.skyUniforms.topColor.value.copy(top);
    this.skyUniforms.bottomColor.value.copy(bottom);

    // Nebel + Hintergrund
    this.fogColor.copy(bottom).lerp(top, 0.35);
    if (this.underwater) {
      this.fogColor.set(0x1a4a8c);
      this.scene.fog.near = 2;
      this.scene.fog.far = 22;
    } else {
      const dist = renderDistance * 16;
      this.scene.fog.near = Math.max(24, dist * 0.45);
      this.scene.fog.far = Math.max(60, dist * 1.15);
    }

    // Sonne & Mond positionieren (folgen der Kamera)
    const camPos = this.camera.position;
    const skyR = 320;
    this.sun.position.set(camPos.x + sunX * skyR, camPos.y + sunY * skyR * 0.75 + 30, camPos.z - 60);
    this.sun.lookAt(camPos);
    this.moon.position.set(camPos.x - sunX * skyR, camPos.y - sunY * skyR * 0.75 + 30, camPos.z + 60);
    this.moon.lookAt(camPos);

    this.sun.material.opacity = Math.min(1, dayFactor * 1.4 + duskFactor * 0.6);
    this.moon.material.opacity = Math.min(1, 1 - dayFactor + 0.15);
    this.starMaterial.opacity = Math.max(0, 1 - dayFactor * 1.6) * 0.95;

    // Wolken bewegen
    this.clouds.position.x = camPos.x + (this._animTime * 1.2) % 220;
    this.clouds.position.z = camPos.z;
    this.cloudMaterial.opacity = 0.55 + (1 - dayFactor) * 0.12 + raining * 0.25;

    // Lichtfarben
    this.hemiLight.intensity = 0.25 + dayFactor * 0.85;
    this.dirLight.intensity = 0.15 + dayFactor * 0.9;
    this.dirLight.position.set(camPos.x + sunX * 80, camPos.y + Math.max(10, sunY * 120), camPos.z + 30);
    this.dirLight.color.setHex(duskFactor > 0.2 ? 0xffb070 : 0xfff2d5);

    // Wasser/Lava animieren (4 Frames)
    const frame = Math.floor(this._animTime * 3.2) % 4;
    this.waterTexture.offset.x = frame / 4;
    this.waterTexture.repeat.set(1 / 4, 1);
    this.lavaTexture.offset.x = frame / 4;
    this.lavaTexture.repeat.set(1 / 4, 1);

    // Regen
    if (this._rainPoints) {
      const targetOpacity = raining > 0 ? 0.5 * raining : 0;
      this._rainMaterial.opacity += (targetOpacity - this._rainMaterial.opacity) * Math.min(1, dt * 2);
      if (this._rainMaterial.opacity > 0.01) {
        const pos = this._rainPositions;
        for (let i = 0; i < pos.length; i += 3) {
          pos[i + 1] -= dt * 28;
          if (pos[i + 1] < -8) {
            pos[i + 1] = 26;
            pos[i] = (Math.random() - 0.5) * 60;
            pos[i + 2] = (Math.random() - 0.5) * 60;
          }
        }
        this._rainGeom.attributes.position.needsUpdate = true;
        this._rainPoints.position.set(camPos.x, camPos.y, camPos.z);
      }
    }
  }

  /** Gibt true wenn es taghell ist (für Mobs etc.). */
  isDay() {
    const sunY = Math.cos(this.timeOfDay * Math.PI * 2);
    return sunY > -0.12;
  }

  render() {
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
}
