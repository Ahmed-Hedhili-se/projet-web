import { Component, ElementRef, OnDestroy, afterNextRender, effect, inject, signal, viewChild } from '@angular/core';
import { PlanetOnScreen, SceneSync, ScreenPoint } from '../../core/services/scene-sync';
import { clamp } from './planet-math';
import type { PlanetScene } from './planet-scene';

interface NetworkNode extends ScreenPoint {
  vx: number;
  vy: number;
  radius: number;
  tinted: boolean;
  visible: number;
}

interface Packet {
  path: ScreenPoint[];
  segment: number;
  t: number;
}

const LINK_DISTANCE = 140;
const MOUSE_DISTANCE = 180;
const PLUG_DISTANCE = 90;
const PLANET_MARGIN = 24;
const PACKET_LINK_TIME = 0.8;
const MAX_PACKETS = 3;
const COLOR = '245, 245, 247';

@Component({
  selector: 'app-site-background',
  templateUrl: './site-background.html',
})
export class SiteBackground implements OnDestroy {
  private readonly sync = inject(SceneSync);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly planetCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('planetCanvas');

  protected readonly planetReady = signal(false);

  private context: CanvasRenderingContext2D | null = null;
  private planet: PlanetScene | null = null;
  private nodes: NetworkNode[] = [];
  private packets: Packet[] = [];
  private packetTimer = 2;
  private width = 0;
  private height = 0;
  private mouse: ScreenPoint | null = null;
  private frame = 0;
  private lastTime = 0;
  private started = false;
  private destroyed = false;
  private readonly reduceMotion = this.sync.reduceMotion;

  private readonly onResize = () => this.resize();
  private readonly onPointerMove = (event: PointerEvent) => (this.mouse = { x: event.clientX, y: event.clientY });
  private readonly onPointerLeave = () => (this.mouse = null);
  private readonly onVisibilityChange = () => (document.hidden ? cancelAnimationFrame(this.frame) : this.start());
  private readonly onScroll = () => this.requestStill();

  constructor() {
    afterNextRender(() => this.init());
    effect(() => {
      this.sync.path();
      this.requestStill();
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
      return;
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
      this.tick(0);
    } else {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.start();
    }
    void this.loadPlanet();
  }

  private isLite(): boolean {
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  }

  private async loadPlanet(): Promise<void> {
    try {
      const { PlanetScene } = await import('./planet-scene');
      const planet = await PlanetScene.create(this.planetCanvas().nativeElement, this.sync, this.isLite());
      if (this.destroyed) {
        planet.dispose();
        return;
      }
      this.planet = planet;
      this.planetReady.set(true);
      this.requestStill();
    } catch {
      this.planet = null;
    }
  }

  private resize(): void {
    const canvas = this.canvas().nativeElement;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    canvas.width = this.width * ratio;
    canvas.height = this.height * ratio;
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.planet?.resize(this.width, this.height);

    const full = Math.min(90, Math.round((this.width * this.height) / 16000));
    const count = this.isLite() ? Math.max(14, Math.round(full / 2)) : full;
    this.nodes = Array.from({ length: count }, () => this.createNode());
    this.packets = [];
    this.requestStill();
  }

  private createNode(): NetworkNode {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.3,
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
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.tick(dt);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  private tick(dt: number): void {
    this.sync.tickAccent(dt);
    this.planet?.render(dt);
    if (dt > 0) {
      this.move();
      this.movePackets(dt);
    } else {
      this.hideBehindPlanet();
    }
    this.draw();
  }

  private requestStill(): void {
    if (!this.reduceMotion || !this.started) {
      return;
    }
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.tick(0));
  }

  private move(): void {
    const planet = this.sync.frame.planet;
    for (const node of this.nodes) {
      if (this.mouse) {
        const dx = this.mouse.x - node.x;
        const dy = this.mouse.y - node.y;
        const distance = Math.hypot(dx, dy);
        if (distance < MOUSE_DISTANCE && distance > 1) {
          node.x += (dx / distance) * 0.25;
          node.y += (dy / distance) * 0.25;
        }
      }
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > this.width) node.vx *= -1;
      if (node.y < 0 || node.y > this.height) node.vy *= -1;

      if (planet) {
        const dx = node.x - planet.x;
        const dy = node.y - planet.y;
        const distance = Math.hypot(dx, dy) || 1;
        const limit = planet.radius + PLANET_MARGIN;
        if (distance < limit) {
          const push = Math.min(4, (limit - distance) * 0.08 + 0.3);
          node.x += (dx / distance) * push;
          node.y += (dy / distance) * push;
        }
        const stuck = node.x <= 0 || node.x >= this.width || node.y <= 0 || node.y >= this.height;
        if (distance < planet.radius && stuck) {
          Object.assign(node, this.createNode());
        }
      }
      node.x = clamp(node.x, 0, this.width);
      node.y = clamp(node.y, 0, this.height);
    }
    this.hideBehindPlanet();
  }

  private hideBehindPlanet(): void {
    const planet = this.sync.frame.planet;
    for (const node of this.nodes) {
      node.visible = planet ? clamp((Math.hypot(node.x - planet.x, node.y - planet.y) - planet.radius) / PLANET_MARGIN, 0, 1) : 1;
    }
  }

  private movePackets(dt: number): void {
    this.packetTimer -= dt;
    if (this.packetTimer <= 0) {
      this.packetTimer = 1.2 + Math.random() * 1.3;
      this.spawnPacket();
    }
    for (const packet of this.packets) {
      packet.t += dt / PACKET_LINK_TIME;
      if (packet.t >= 1) {
        packet.t = 0;
        packet.segment++;
      }
    }
    const arrived = this.packets.filter((packet) => packet.segment >= packet.path.length - 1);
    for (const packet of arrived) {
      const marker = packet.path[packet.path.length - 1];
      this.sync.frame.pulses.push({ x: marker.x, y: marker.y });
    }
    this.packets = this.packets.filter((packet) => !arrived.includes(packet));
  }

  private spawnPacket(): void {
    const markers = this.sync.frame.markers;
    if (markers.length === 0 || this.packets.length >= MAX_PACKETS) {
      return;
    }
    for (let tries = 0; tries < 6; tries++) {
      const marker = markers[Math.floor(Math.random() * markers.length)];
      const usable = this.nodes.filter((node) => node.visible > 0.5);
      const first = usable.find((node) => Math.hypot(node.x - marker.x, node.y - marker.y) < PLUG_DISTANCE);
      if (!first) {
        continue;
      }
      const chain = [first];
      const hops = 1 + Math.floor(Math.random() * 3);
      for (let hop = 0; hop < hops; hop++) {
        const from = chain[0];
        const next = usable.find((node) => !chain.includes(node) && Math.hypot(node.x - from.x, node.y - from.y) < LINK_DISTANCE);
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
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = clamp(((planet.x - a.x) * abx + (planet.y - a.y) * aby) / (abx * abx + aby * aby || 1), 0, 1);
    return Math.hypot(planet.x - (a.x + abx * t), planet.y - (a.y + aby * t)) < planet.radius;
  }

  private draw(): void {
    const ctx = this.context;
    if (!ctx) {
      return;
    }
    const frame = this.sync.frame;
    const planet = frame.planet;
    const accent = `${Math.round(frame.accent.r * 255)}, ${Math.round(frame.accent.g * 255)}, ${Math.round(frame.accent.b * 255)}`;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalAlpha = this.sync.mode() === 'hero' ? 0.6 + 0.4 * clamp(frame.scrollProgress / 0.3, 0, 1) : 1;
    ctx.lineWidth = 1;

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const visible = Math.min(a.visible, b.visible);
        if (distance < LINK_DISTANCE && visible > 0 && !(planet && this.crossesPlanet(a, b, planet))) {
          ctx.strokeStyle = `rgba(${COLOR}, ${(1 - distance / LINK_DISTANCE) * 0.16 * visible})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const marker of frame.markers) {
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
      if (node.visible <= 0) {
        continue;
      }
      if (this.mouse) {
        const distance = Math.hypot(this.mouse.x - node.x, this.mouse.y - node.y);
        if (distance < MOUSE_DISTANCE) {
          ctx.strokeStyle = `rgba(${accent}, ${(1 - distance / MOUSE_DISTANCE) * 0.4 * node.visible})`;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(this.mouse.x, this.mouse.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = node.tinted ? `rgba(${accent}, ${0.8 * node.visible})` : `rgba(${COLOR}, ${0.55 * node.visible})`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const packet of this.packets) {
      const from = packet.path[packet.segment];
      const to = packet.path[packet.segment + 1];
      if (!from || !to) {
        continue;
      }
      const x = from.x + (to.x - from.x) * packet.t;
      const y = from.y + (to.y - from.y) * packet.t;
      ctx.strokeStyle = `rgba(${accent}, 0.45)`;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(${accent}, 0.2)`;
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
