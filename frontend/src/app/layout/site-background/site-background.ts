import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { PlanetOnScreen, SceneSync, ScreenPoint } from '../../core/services/scene-sync';
import { clamp } from './planet-math';
import type { PlanetScene } from './planet-scene';

interface NetworkNode extends ScreenPoint {
  // un point du réseau neuronal (x, y à l'écran)
  vx: number; // vitesse horizontale (pixels par image)
  vy: number; // vitesse verticale
  radius: number;
  tinted: boolean; // ~15 % des points portent la couleur Aurore
  visible: number; // 0 = caché par la planète · 1 = bien visible
}

interface Packet {
  // « paquet de données » qui voyage jusqu'à un data center
  path: ScreenPoint[]; // points du réseau traversés, puis le data center
  segment: number; // lien en cours de parcours
  t: number; // avancement sur ce lien (0 → 1)
}

const LINK_DISTANCE = 140; // deux points plus proches que ça sont reliés (pixels)
const MOUSE_DISTANCE = 180; // rayon d'influence de la souris
const PLUG_DISTANCE = 90; // un point aussi proche d'un data center s'y branche
const PLANET_MARGIN = 24; // espace gardé libre autour de la planète
const PACKET_LINK_TIME = 0.8; // secondes pour parcourir un lien
const MAX_PACKETS = 3;
const COLOR = '245, 245, 247'; // Porcelain (#f5f5f7) en RGB, pour jouer sur la transparence

@Component({
  selector: 'app-site-background',
  templateUrl: './site-background.html',
})
export class SiteBackground implements OnDestroy {
  // fond fixe du site : grille + planète 3D + réseau neuronal animé
  private readonly sync = inject(SceneSync); // état partagé entre la planète et le réseau
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly planetCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('planetCanvas');

  protected readonly planetReady = signal(false); // la planète apparaît en fondu quand elle est chargée

  private context: CanvasRenderingContext2D | null = null;
  private planet: PlanetScene | null = null; // null : pas encore chargée, ou WebGL indisponible
  private nodes: NetworkNode[] = [];
  private packets: Packet[] = [];
  private packetTimer = 2; // secondes avant le prochain paquet de données
  private width = 0;
  private height = 0;
  private mouse: ScreenPoint | null = null; // position de la souris (null = hors de la fenêtre)
  private frame = 0; // identifiant de l'image d'animation en cours
  private lastTime = 0; // heure de l'image précédente (ms)
  private started = false;
  private destroyed = false;
  private readonly reduceMotion = this.sync.reduceMotion;

  private readonly onResize = () => this.resize();
  private readonly onPointerMove = (event: PointerEvent) =>
    (this.mouse = { x: event.clientX, y: event.clientY });
  private readonly onPointerLeave = () => (this.mouse = null);
  private readonly onVisibilityChange = () =>
    document.hidden ? cancelAnimationFrame(this.frame) : this.start();
  private readonly onScroll = () => this.requestStill(); // animations réduites : la couleur suit quand même le défilement

  constructor() {
    afterNextRender(() => this.init()); // les canvas n'existent qu'après le premier affichage
    effect(() => {
      this.sync.path(); // à chaque changement de page…
      this.requestStill(); // …on redessine l'image fixe (animations réduites)
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('pointerleave', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.planet?.dispose();
  }

  private init(): void {
    if (navigator.userAgent.includes('jsdom')) {
      return; // environnement de test : pas de vrai canvas
    }
    this.context = this.canvas().nativeElement.getContext('2d');
    if (!this.context) {
      return;
    }
    this.started = true;
    this.resize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerleave', this.onPointerLeave);

    if (this.reduceMotion) {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.tick(0); // animations réduites : une seule image fixe
    } else {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.start();
    }
    void this.loadPlanet(); // la 3D se charge ensuite, sans bloquer l'affichage du site
  }

  private isLite(): boolean {
    // version légère : mobile, tablette, écran tactile
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  }

  private async loadPlanet(): Promise<void> {
    try {
      const { PlanetScene } = await import('./planet-scene'); // Three.js est téléchargé seulement ici (pas dans le premier chargement)
      const planet = await PlanetScene.create(
        this.planetCanvas().nativeElement,
        this.sync,
        this.isLite(),
      );
      if (this.destroyed) {
        planet.dispose();
        return;
      }
      this.planet = planet;
      this.planetReady.set(true);
      this.requestStill();
    } catch {
      this.planet = null; // pas de WebGL ou texture introuvable : le réseau neuronal reste seul
    }
  }

  private resize(): void {
    // adapte les canvas à la fenêtre (net sur les écrans haute densité)
    const canvas = this.canvas().nativeElement;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    canvas.width = this.width * ratio;
    canvas.height = this.height * ratio;
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.planet?.resize(this.width, this.height);

    const full = Math.min(90, Math.round((this.width * this.height) / 16000)); // moins de points sur petit écran
    const count = this.isLite() ? Math.max(14, Math.round(full / 2)) : full; // version légère : deux fois moins de points
    this.nodes = Array.from({ length: count }, () => this.createNode());
    this.packets = [];
    this.requestStill();
  }

  private createNode(): NetworkNode {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.3, // mouvement lent, dans une direction au hasard
      vy: (Math.random() - 0.5) * 0.3,
      radius: 0.8 + Math.random() * 1.4,
      tinted: Math.random() < 0.15,
      visible: 1,
    };
  }

  private start(): void {
    cancelAnimationFrame(this.frame);
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000); // secondes depuis l'image précédente (plafonné)
      this.lastTime = now;
      this.tick(dt);
      this.frame = requestAnimationFrame(loop); // environ 60 images par seconde
    };
    this.frame = requestAnimationFrame(loop);
  }

  private tick(dt: number): void {
    // une image : couleur, planète, puis réseau neuronal
    this.sync.tickAccent(dt); // fait évoluer la couleur Aurore (--aurora)
    this.planet?.render(dt);
    if (dt > 0) {
      this.move();
      this.movePackets(dt);
    } else {
      this.hideBehindPlanet(); // image fixe : on cache seulement les points sous la planète
    }
    this.draw();
  }

  private requestStill(): void {
    // animations réduites : redessine une image fixe au prochain rafraîchissement
    if (!this.reduceMotion || !this.started) {
      return;
    }
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.tick(0));
  }

  private move(): void {
    // fait avancer chaque point
    const planet = this.sync.frame.planet;
    for (const node of this.nodes) {
      if (this.mouse) {
        const dx = this.mouse.x - node.x;
        const dy = this.mouse.y - node.y;
        const distance = Math.hypot(dx, dy);
        if (distance < MOUSE_DISTANCE && distance > 1) {
          node.x += (dx / distance) * 0.25; // légère attraction vers la souris
          node.y += (dy / distance) * 0.25;
        }
      }
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > this.width) node.vx *= -1; // rebondit sur les bords
      if (node.y < 0 || node.y > this.height) node.vy *= -1;

      if (planet) {
        // le réseau contourne la planète
        const dx = node.x - planet.x;
        const dy = node.y - planet.y;
        const distance = Math.hypot(dx, dy) || 1;
        const limit = planet.radius + PLANET_MARGIN;
        if (distance < limit) {
          const push = Math.min(4, (limit - distance) * 0.08 + 0.3); // poussée douce vers l'extérieur
          node.x += (dx / distance) * push;
          node.y += (dy / distance) * push;
        }
        const stuck = node.x <= 0 || node.x >= this.width || node.y <= 0 || node.y >= this.height;
        if (distance < planet.radius && stuck) {
          Object.assign(node, this.createNode()); // coincé sous la planète contre un bord : il repart ailleurs
        }
      }
      node.x = clamp(node.x, 0, this.width);
      node.y = clamp(node.y, 0, this.height);
    }
    this.hideBehindPlanet();
  }

  private hideBehindPlanet(): void {
    // un point s'efface en approchant de la planète (jamais dessiné devant elle)
    const planet = this.sync.frame.planet;
    for (const node of this.nodes) {
      node.visible = planet
        ? clamp(
            (Math.hypot(node.x - planet.x, node.y - planet.y) - planet.radius) / PLANET_MARGIN,
            0,
            1,
          )
        : 1;
    }
  }

  private movePackets(dt: number): void {
    // paquets de données : création, déplacement, arrivée
    this.packetTimer -= dt;
    if (this.packetTimer <= 0) {
      this.packetTimer = 1.2 + Math.random() * 1.3; // un nouveau paquet toutes les 1,2 à 2,5 s
      this.spawnPacket();
    }
    for (const packet of this.packets) {
      packet.t += dt / PACKET_LINK_TIME;
      if (packet.t >= 1) {
        packet.t = 0;
        packet.segment++; // passe au lien suivant
      }
    }
    const arrived = this.packets.filter((packet) => packet.segment >= packet.path.length - 1);
    for (const packet of arrived) {
      const marker = packet.path[packet.path.length - 1];
      this.sync.frame.pulses.push({ x: marker.x, y: marker.y }); // le data center émet une onde plus forte (lue par la planète)
    }
    this.packets = this.packets.filter((packet) => !arrived.includes(packet));
  }

  private spawnPacket(): void {
    // choisit un data center branché au réseau et un chemin de 2 à 4 liens
    const markers = this.sync.frame.markers;
    if (markers.length === 0 || this.packets.length >= MAX_PACKETS) {
      return;
    }
    for (let tries = 0; tries < 6; tries++) {
      const marker = markers[Math.floor(Math.random() * markers.length)];
      const usable = this.nodes.filter((node) => node.visible > 0.5);
      const first = usable.find(
        (node) => Math.hypot(node.x - marker.x, node.y - marker.y) < PLUG_DISTANCE,
      );
      if (!first) {
        continue; // aucun point branché sur ce data center : on en essaie un autre
      }
      const chain = [first];
      const hops = 1 + Math.floor(Math.random() * 3);
      for (let hop = 0; hop < hops; hop++) {
        // remonte le réseau de voisin en voisin
        const from = chain[0];
        const next = usable.find(
          (node) =>
            !chain.includes(node) && Math.hypot(node.x - from.x, node.y - from.y) < LINK_DISTANCE,
        );
        if (!next) {
          break;
        }
        chain.unshift(next);
      }
      this.packets.push({ path: [...chain, marker], segment: 0, t: 0 });
      return;
    }
  }

  private crossesPlanet(a: ScreenPoint, b: ScreenPoint, planet: PlanetOnScreen): boolean {
    // le lien a–b passe-t-il devant la planète ?
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = clamp(
      ((planet.x - a.x) * abx + (planet.y - a.y) * aby) / (abx * abx + aby * aby || 1),
      0,
      1,
    );
    return Math.hypot(planet.x - (a.x + abx * t), planet.y - (a.y + aby * t)) < planet.radius; // point du lien le plus proche du centre
  }

  private draw(): void {
    const ctx = this.context;
    if (!ctx) {
      return;
    }
    const frame = this.sync.frame;
    const planet = frame.planet;
    const accent = `${Math.round(frame.accent.r * 255)}, ${Math.round(frame.accent.g * 255)}, ${Math.round(frame.accent.b * 255)}`; // couleur Aurore du moment
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalAlpha =
      this.sync.mode() === 'hero' ? 0.6 + 0.4 * clamp(frame.scrollProgress / 0.3, 0, 1) : 1;
    ctx.lineWidth = 1;

    for (let i = 0; i < this.nodes.length; i++) {
      // liens entre les points proches
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const visible = Math.min(a.visible, b.visible);
        if (
          distance < LINK_DISTANCE &&
          visible > 0 &&
          !(planet && this.crossesPlanet(a, b, planet))
        ) {
          ctx.strokeStyle = `rgba(${COLOR}, ${(1 - distance / LINK_DISTANCE) * 0.16 * visible})`; // plus proche = plus visible
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const marker of frame.markers) {
      // le réseau se branche sur les data centers de la planète
      for (const node of this.nodes) {
        const distance = Math.hypot(marker.x - node.x, marker.y - node.y);
        if (distance < PLUG_DISTANCE && node.visible > 0) {
          ctx.strokeStyle = `rgba(${accent}, ${(1 - distance / PLUG_DISTANCE) * 0.35 * node.visible})`;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(marker.x, marker.y);
          ctx.stroke();
        }
      }
    }

    for (const node of this.nodes) {
      // liens vers la souris + points
      if (node.visible <= 0) {
        continue;
      }
      if (this.mouse) {
        const distance = Math.hypot(this.mouse.x - node.x, this.mouse.y - node.y);
        if (distance < MOUSE_DISTANCE) {
          ctx.strokeStyle = `rgba(${accent}, ${(1 - distance / MOUSE_DISTANCE) * 0.4 * node.visible})`; // liens « actifs » : couleur Aurore
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(this.mouse.x, this.mouse.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = node.tinted
        ? `rgba(${accent}, ${0.8 * node.visible})`
        : `rgba(${COLOR}, ${0.55 * node.visible})`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const packet of this.packets) {
      // paquets de données en route vers un data center
      const from = packet.path[packet.segment];
      const to = packet.path[packet.segment + 1];
      if (!from || !to) {
        continue;
      }
      const x = from.x + (to.x - from.x) * packet.t;
      const y = from.y + (to.y - from.y) * packet.t;
      ctx.strokeStyle = `rgba(${accent}, 0.45)`; // le lien parcouru s'allume
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(${accent}, 0.2)`; // petite lueur autour du paquet
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${accent}, 1)`;
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
