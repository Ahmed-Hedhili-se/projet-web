import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { SceneSync, ScreenPoint } from '../../core/services/scene-sync';
import { Stop, clamp, easeOutCubic, latLonToUv, sampleStops, uvToSphere } from './planet-math';
import {
  CLOUD_FRAGMENT,
  EARTH_FRAGMENT,
  HALO_FRAGMENT,
  HALO_VERTEX,
  MARKERS_FRAGMENT,
  MARKERS_VERTEX,
  STARS_FRAGMENT,
  STARS_VERTEX,
  SURFACE_VERTEX,
} from './planet-shaders';

const RADIUS = 1.95;
const TILT = 0.37;
const SPIN = 0.03;
const START_ROTATION = 2.07;
const FOV = 40;
const CAMERA_Z = 8;
const ENTRY_DURATION = 1.9;
const ENTRY_START_Y = -6.5;
const POINTER_TILT = 0.08;
const SLOW_FRAME = 1 / 45;

const STOPS_X: Stop[] = [
  { p: 0, v: 0 },
  { p: 0.32, v: -3.1 },
  { p: 0.64, v: 3.2 },
  { p: 1, v: 0 },
];
const STOPS_Y: Stop[] = [
  { p: 0, v: -4.75 },
  { p: 0.32, v: 0.55 },
  { p: 0.64, v: 0.45 },
  { p: 1, v: 0.15 },
];
const STOPS_S: Stop[] = [
  { p: 0, v: 2.15 },
  { p: 0.32, v: 1.0 },
  { p: 0.64, v: 0.92 },
  { p: 1, v: 1.12 },
];

const DATA_CENTERS = [
  { lat: 36.8, lon: 10.2 },
  { lat: 50.1, lon: 8.7 },
  { lat: 38.9, lon: -77.4 },
];

const TEXTURE_FILES = [
  'earth_atmos_2048.webp',
  'earth_lights_2048.webp',
  'earth_clouds_1024.png',
  'earth_specular_2048.webp',
  'earth_normal_2048.webp',
];

interface CloudShell {
  mesh: THREE.Mesh;
  offset: number;
  drift: number;
}

export class PlanetScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  private readonly world = new THREE.Group();
  private readonly tilt = new THREE.Group();
  private readonly earth: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly halo: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly stars: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly markers: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly clouds: CloudShell[] = [];
  private readonly markerPositions: THREE.Vector3[] = [];
  private readonly markerPulses: Float32Array;
  private readonly markerScreen: ScreenPoint[] = [];
  private composer: EffectComposer | null = null;
  private readonly basePixelRatio: number;
  private quality = 0;
  private sampleTime = 0;
  private sampleFrames = 0;
  private readonly accent = new THREE.Color();
  private readonly white = new THREE.Color(0xffffff);
  private readonly tmp = new THREE.Vector3();
  private readonly tmpCenter = new THREE.Vector3();

  private width = 1;
  private height = 1;
  private time = 0;
  private spinPhase = 0;
  private entryTime = 0;
  private entryActive: boolean;
  private progress = 0;
  private x = 0;
  private y = 0;
  private scale = 1;
  private haloIntensity = 3;

  static async create(
    canvas: HTMLCanvasElement,
    sync: SceneSync,
    lite: boolean,
  ): Promise<PlanetScene> {
    if (!document.createElement('canvas').getContext('webgl2')) {
      throw new Error('WebGL is not available');
    }
    const loader = new THREE.TextureLoader();
    const textures = await Promise.all(
      TEXTURE_FILES.map((file) => loader.loadAsync(`textures/earth/${file}`)),
    );
    return new PlanetScene(canvas, sync, lite, textures);
  }

  private constructor(
    canvas: HTMLCanvasElement,
    private readonly sync: SceneSync,
    private readonly lite: boolean,
    textures: THREE.Texture[],
  ) {
    const [day, night, cloudMap, ocean, relief] = textures;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.basePixelRatio = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 1.5);
    this.renderer.setPixelRatio(this.basePixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    day.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    for (const texture of [day, night, relief]) {
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    }

    this.camera.position.set(0, 0, CAMERA_Z);
    this.scene.add(this.world);
    this.world.add(this.tilt);

    const segments = lite ? 64 : 96;
    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, segments, segments),
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: EARTH_FRAGMENT,
        uniforms: {
          dayMap: { value: day },
          nightMap: { value: night },
          oceanMap: { value: ocean },
          reliefMap: { value: relief },
          time: { value: 0 },
          nightLights: { value: 2.6 },
          rimColor: { value: new THREE.Color(0x9fc4ff) },
        },
      }),
    );
    this.tilt.add(this.earth);

    const shells = [
      { height: 1.006, opacity: 0.5, drift: 0.012, offset: 0 },
      { height: 1.03, opacity: 0.2, drift: 0.03, offset: 2.2 },
      { height: 1.075, opacity: 0.1, drift: 0.05, offset: 4.3 },
    ].slice(0, lite ? 2 : 3);
    for (const shell of shells) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS * shell.height, 64, 64),
        new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERTEX,
          fragmentShader: CLOUD_FRAGMENT,
          uniforms: { cloudMap: { value: cloudMap }, opacity: { value: shell.opacity } },
          transparent: true,
          depthWrite: false,
        }),
      );
      mesh.renderOrder = 2;
      this.tilt.add(mesh);
      this.clouds.push({ mesh, offset: shell.offset, drift: shell.drift });
    }

    this.halo = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: HALO_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        uniforms: {
          glowColor: { value: new THREE.Color(0x3a6cff) },
          intensity: { value: this.haloIntensity },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.halo.scale.setScalar(RADIUS * 2.3);
    this.world.add(this.halo);

    this.stars = this.createStars(lite ? 1000 : 1400);
    this.scene.add(this.stars);

    const markerCount = lite ? 24 : 40;
    this.markerPulses = new Float32Array(markerCount);
    this.markers = this.createMarkers(ocean.image as HTMLImageElement, markerCount);
    this.earth.add(this.markers);

    if (lite) {
      this.quality = 1;
    } else {
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, target);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.6, 0.82));
      this.composer.addPass(new OutputPass());
    }

    this.entryActive = sync.mode() === 'hero' && !sync.reduceMotion;
    this.resize(window.innerWidth, window.innerHeight);
    this.progress = sync.frame.scrollProgress;
    const start = this.target();
    this.x = start.x;
    this.y = start.y;
    this.scale = start.scale;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(width, height);
  }

  render(dt: number): void {
    const frame = this.sync.frame;
    const still = this.sync.reduceMotion;
    this.time += dt;

    this.progress = still
      ? 0
      : this.progress + (frame.scrollProgress - this.progress) * Math.min(1, dt * 4.5);
    const target = this.target();
    const k = still ? 1 : Math.min(1, dt * 3.2);
    this.x += (target.x - this.x) * k;
    this.y += (target.y - this.y) * k;
    this.scale += (target.scale - this.scale) * k;

    let entryY = 0;
    if (this.entryActive) {
      this.entryTime += dt;
      entryY = ENTRY_START_Y * (1 - easeOutCubic(this.entryTime / ENTRY_DURATION));
      this.entryActive = this.entryTime < ENTRY_DURATION;
    }
    this.world.position.set(this.x, this.y + entryY, 0);
    this.world.scale.setScalar(this.scale);

    this.spinPhase += dt * SPIN;
    this.earth.rotation.y = START_ROTATION + this.spinPhase + this.progress * Math.PI * 1.6;
    for (const cloud of this.clouds) {
      cloud.mesh.rotation.y = this.earth.rotation.y + cloud.offset + this.time * cloud.drift;
    }

    const pointer = frame.pointer;
    const tiltX = pointer && !still ? (pointer.y / this.height - 0.5) * 2 * POINTER_TILT : 0;
    const tiltY = pointer && !still ? (pointer.x / this.width - 0.5) * 2 * POINTER_TILT : 0;
    const tiltK = Math.min(1, dt * 2);
    this.tilt.rotation.x += (tiltX - this.tilt.rotation.x) * tiltK;
    this.tilt.rotation.y += (tiltY - this.tilt.rotation.y) * tiltK;
    this.tilt.rotation.z = TILT;

    this.accent.setRGB(frame.accent.r, frame.accent.g, frame.accent.b, THREE.SRGBColorSpace);
    const hero = this.sync.mode() === 'hero';
    this.haloIntensity += ((hero ? 3 : 1.8) - this.haloIntensity) * k;
    this.halo.material.uniforms['glowColor'].value.copy(this.accent);
    this.halo.material.uniforms['intensity'].value = this.haloIntensity;
    this.earth.material.uniforms['rimColor'].value.copy(this.accent).lerp(this.white, 0.55);
    this.earth.material.uniforms['time'].value = this.time / 12;

    const bufferHeight = this.height * this.renderer.getPixelRatio();
    this.stars.material.uniforms['time'].value = this.time;
    this.stars.material.uniforms['pixelScale'].value = bufferHeight / 900;
    this.stars.material.uniforms['starColor'].value.set(0xf5f5f7).lerp(this.accent, 0.2);
    this.stars.rotation.y = this.progress * 0.12;
    this.markers.material.uniforms['time'].value = this.time;
    this.markers.material.uniforms['pixelScale'].value =
      (bufferHeight / 900) * Math.pow(this.scale, 0.6);

    this.updatePulses(dt);
    if (!still) {
      this.adaptQuality(dt);
    }
    if (this.composer) {
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.publish();
  }

  dispose(): void {
    this.scene.traverse((object) => {
      const item = object as THREE.Mesh;
      item.geometry?.dispose();
      const material = item.material as THREE.ShaderMaterial | undefined;
      if (material?.uniforms) {
        for (const uniform of Object.values(material.uniforms)) {
          if (uniform.value instanceof THREE.Texture) {
            uniform.value.dispose();
          }
        }
        material.dispose();
      }
    });
    this.composer?.dispose();
    this.renderer.dispose();
    document.documentElement.classList.remove('scene-low');
    this.sync.frame.planet = null;
    this.sync.frame.markers = [];
  }

  private adaptQuality(dt: number): void {
    if (this.quality >= 2 || this.time < 2 || document.hidden) {
      return;
    }
    this.sampleTime += dt;
    this.sampleFrames++;
    if (this.sampleFrames < 60) {
      return;
    }
    const average = this.sampleTime / this.sampleFrames;
    this.sampleTime = 0;
    this.sampleFrames = 0;
    if (average <= SLOW_FRAME) {
      return;
    }
    this.quality++;
    if (this.quality === 1) {
      this.composer?.dispose();
      this.composer = null;
    } else {
      this.renderer.setPixelRatio(this.basePixelRatio * 0.7);
      this.renderer.setSize(this.width, this.height, false);
      if (this.clouds.length > 2) {
        this.clouds[2].mesh.visible = false;
      }
      document.documentElement.classList.add('scene-low');
    }
  }

  private target(): { x: number; y: number; scale: number } {
    if (this.sync.mode() === 'hero') {
      const p = this.progress;
      const fit = clamp(this.width / 1100, 0.55, 1);
      const side = clamp(this.width / 1200, 0.5, 1);
      const scale = sampleStops(STOPS_S, p) * fit;
      const lift = RADIUS * sampleStops(STOPS_S, p) * (1 - fit) * (1 - clamp(p / 0.32, 0, 1));
      return { x: sampleStops(STOPS_X, p) * side, y: sampleStops(STOPS_Y, p) + lift, scale };
    }
    const unitsPerPixel =
      (2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / this.height;
    const radius = this.lite ? 72 : clamp(this.width * 0.08, 90, 130);
    const centerX = this.width - 18 - radius;
    const centerY = this.height - 18 - radius;
    return {
      x: (centerX - this.width / 2) * unitsPerPixel,
      y: -(centerY - this.height / 2) * unitsPerPixel,
      scale: (radius * unitsPerPixel) / RADIUS,
    };
  }

  private updatePulses(dt: number): void {
    const frame = this.sync.frame;
    const pointer = frame.pointer;
    let changed = false;
    for (const pulse of frame.pulses) {
      const index = this.nearestMarker(pulse, 40);
      if (index >= 0) {
        this.markerPulses[index] = 1;
        changed = true;
      }
    }
    frame.pulses.length = 0;
    if (pointer) {
      const index = this.nearestMarker(pointer, 60);
      if (index >= 0 && this.markerPulses[index] < 0.6) {
        this.markerPulses[index] = 0.6;
        changed = true;
      }
    }
    for (let i = 0; i < this.markerPulses.length; i++) {
      if (this.markerPulses[i] > 0) {
        this.markerPulses[i] = Math.max(0, this.markerPulses[i] - dt * 0.9);
        changed = true;
      }
    }
    if (changed) {
      this.markers.geometry.getAttribute('pulse').needsUpdate = true;
    }
  }

  private nearestMarker(point: ScreenPoint, maxDistance: number): number {
    let best = -1;
    let bestDistance = maxDistance;
    for (const marker of this.sync.frame.markers) {
      const distance = Math.hypot(marker.x - point.x, marker.y - point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = this.markerScreen.indexOf(marker);
      }
    }
    return best;
  }

  private publish(): void {
    const frame = this.sync.frame;
    const focal = this.height / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const center = this.world.position;
    const worldRadius = RADIUS * this.scale;
    const distance = this.camera.position.distanceTo(center);
    const lateral = Math.hypot(center.x, center.y);
    const angleToCenter = Math.atan2(lateral, CAMERA_Z - center.z);
    const angularRadius = Math.asin(Math.min(0.999, worldRadius / distance));
    const inner = focal * Math.tan(angleToCenter - angularRadius);
    const outer = focal * Math.tan(Math.min(angleToCenter + angularRadius, 1.4));
    const middle = (inner + outer) / 2;
    const dirX = lateral > 1e-6 ? center.x / lateral : 1;
    const dirY = lateral > 1e-6 ? center.y / lateral : 0;
    frame.planet = {
      x: this.width / 2 + dirX * middle,
      y: this.height / 2 - dirY * middle,
      radius: (outer - inner) / 2,
    };

    frame.markers.length = 0;
    this.earth.getWorldPosition(this.tmpCenter);
    for (let i = 0; i < this.markerPositions.length; i++) {
      const world = this.earth.localToWorld(this.tmp.copy(this.markerPositions[i]));
      const nx = world.x - this.tmpCenter.x;
      const ny = world.y - this.tmpCenter.y;
      const nz = world.z - this.tmpCenter.z;
      const vx = this.camera.position.x - world.x;
      const vy = this.camera.position.y - world.y;
      const vz = this.camera.position.z - world.z;
      const facing =
        (nx * vx + ny * vy + nz * vz) / (Math.hypot(nx, ny, nz) * Math.hypot(vx, vy, vz));
      if (facing < 0.3) {
        continue;
      }
      world.project(this.camera);
      const point = this.markerScreen[i];
      point.x = (world.x * 0.5 + 0.5) * this.width;
      point.y = (-world.y * 0.5 + 0.5) * this.height;
      frame.markers.push(point);
    }
  }

  private createStars(count: number): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const brights = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.acos(1 - Math.random() * 0.5);
      const around = Math.random() * Math.PI * 2;
      positions[i * 3] = 90 * Math.sin(angle) * Math.cos(around);
      positions[i * 3 + 1] = 90 * Math.sin(angle) * Math.sin(around);
      positions[i * 3 + 2] = -90 * Math.cos(angle);
      seeds[i] = Math.random() * 100;
      brights[i] = 0.35 + Math.random() * 0.65;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('bright', new THREE.BufferAttribute(brights, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: STARS_VERTEX,
      fragmentShader: STARS_FRAGMENT,
      uniforms: {
        time: { value: 0 },
        size: { value: 1.6 },
        pixelScale: { value: 1 },
        starColor: { value: new THREE.Color(0xf5f5f7) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(geometry, material);
    stars.frustumCulled = false;
    return stars;
  }

  private createMarkers(
    oceanMask: HTMLImageElement,
    count: number,
  ): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
    const maskWidth = 512;
    const maskHeight = 256;
    const canvas = document.createElement('canvas');
    canvas.width = maskWidth;
    canvas.height = maskHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context?.drawImage(oceanMask, 0, 0, maskWidth, maskHeight);
    const pixels = context?.getImageData(0, 0, maskWidth, maskHeight).data;
    const isLand = (u: number, v: number) => {
      const px = Math.min(maskWidth - 1, Math.floor(u * maskWidth));
      const py = Math.min(maskHeight - 1, Math.floor((1 - v) * maskHeight));
      return !pixels || pixels[(py * maskWidth + px) * 4] < 90;
    };

    const places = DATA_CENTERS.map((center) => latLonToUv(center.lat, center.lon));
    for (let tries = 0; places.length < count && tries < count * 200; tries++) {
      const u = Math.random();
      const lat = (Math.asin(Math.random() * 2 - 1) * 180) / Math.PI;
      const v = (lat + 90) / 180;
      const farEnough = places.every((place) => Math.hypot(place.u - u, place.v - v) > 0.035);
      if (Math.abs(lat) < 62 && isLand(u, v) && farEnough) {
        places.push({ u, v });
      }
    }

    const positions = new Float32Array(places.length * 3);
    const seeds = new Float32Array(places.length);
    const majors = new Float32Array(places.length);
    places.forEach((place, i) => {
      const point = uvToSphere(place.u, place.v, RADIUS * 1.012);
      positions.set([point.x, point.y, point.z], i * 3);
      seeds[i] = Math.random();
      majors[i] = i < DATA_CENTERS.length ? 1 : 0;
      this.markerPositions.push(new THREE.Vector3(point.x, point.y, point.z));
      this.markerScreen.push({ x: 0, y: 0 });
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('major', new THREE.BufferAttribute(majors, 1));
    geometry.setAttribute(
      'pulse',
      new THREE.BufferAttribute(this.markerPulses, 1).setUsage(THREE.DynamicDrawUsage),
    );
    const material = new THREE.ShaderMaterial({
      vertexShader: MARKERS_VERTEX,
      fragmentShader: MARKERS_FRAGMENT,
      uniforms: {
        time: { value: 0 },
        size: { value: 16 },
        pixelScale: { value: 1 },
        coreColor: { value: new THREE.Color(0xfff1cf) },
        ringColor: { value: new THREE.Color(0xffd500) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const markers = new THREE.Points(geometry, material);
    markers.frustumCulled = false;
    markers.renderOrder = 3;
    return markers;
  }
}
