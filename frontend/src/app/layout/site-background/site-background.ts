import { Component, ElementRef, OnDestroy, afterNextRender, viewChild } from '@angular/core';

interface NetworkNode {                                    // un point du réseau neuronal
  x: number;
  y: number;
  vx: number;                                              // vitesse horizontale (pixels par image)
  vy: number;                                              // vitesse verticale
  radius: number;
}

const LINK_DISTANCE = 140;                                 // deux points plus proches que ça sont reliés (pixels)
const MOUSE_DISTANCE = 180;                                // rayon d'influence de la souris
const COLOR = '245, 245, 247';                             // Porcelain (#f5f5f7) en RGB, pour jouer sur la transparence

@Component({
  selector: 'app-site-background',
  templateUrl: './site-background.html',
})
export class SiteBackground implements OnDestroy {         // fond fixe du site : grille + réseau neuronal animé
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private context: CanvasRenderingContext2D | null = null;
  private nodes: NetworkNode[] = [];
  private width = 0;
  private height = 0;
  private mouse: { x: number; y: number } | null = null;   // position de la souris (null = hors de la fenêtre)
  private frame = 0;                                       // identifiant de l'image d'animation en cours
  private readonly reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  private readonly onResize = () => this.resize();
  private readonly onPointerMove = (event: PointerEvent) => (this.mouse = { x: event.clientX, y: event.clientY });
  private readonly onPointerLeave = () => (this.mouse = null);
  private readonly onVisibilityChange = () => (document.hidden ? cancelAnimationFrame(this.frame) : this.start()); // pause si l'onglet est caché

  constructor() {
    afterNextRender(() => this.init());                    // le canvas n'existe qu'après le premier affichage
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerleave', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private init(): void {
    if (navigator.userAgent.includes('jsdom')) {
      return;                                              // environnement de test : pas de vrai canvas
    }
    this.context = this.canvas().nativeElement.getContext('2d');
    if (!this.context) {
      return;
    }
    this.resize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerleave', this.onPointerLeave);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    if (this.reduceMotion) {
      this.draw();                                         // animations réduites : une seule image fixe
    } else {
      this.start();
    }
  }

  private resize(): void {                                 // adapte le canvas à la fenêtre (net sur les écrans haute densité)
    const canvas = this.canvas().nativeElement;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    canvas.width = this.width * ratio;
    canvas.height = this.height * ratio;
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0);

    const count = Math.min(90, Math.round((this.width * this.height) / 16000)); // moins de points sur petit écran
    this.nodes = Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.3,                     // mouvement lent, dans une direction au hasard
      vy: (Math.random() - 0.5) * 0.3,
      radius: 0.8 + Math.random() * 1.4,
    }));
    if (this.reduceMotion) {
      this.draw();
    }
  }

  private start(): void {
    cancelAnimationFrame(this.frame);
    const loop = () => {
      this.move();
      this.draw();
      this.frame = requestAnimationFrame(loop);            // environ 60 images par seconde
    };
    this.frame = requestAnimationFrame(loop);
  }

  private move(): void {                                   // fait avancer chaque point
    for (const node of this.nodes) {
      if (this.mouse) {
        const dx = this.mouse.x - node.x;
        const dy = this.mouse.y - node.y;
        const distance = Math.hypot(dx, dy);
        if (distance < MOUSE_DISTANCE && distance > 1) {
          node.x += (dx / distance) * 0.25;                // légère attraction vers la souris
          node.y += (dy / distance) * 0.25;
        }
      }
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > this.width) node.vx *= -1; // rebondit sur les bords
      if (node.y < 0 || node.y > this.height) node.vy *= -1;
    }
  }

  private draw(): void {
    const ctx = this.context;
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.nodes.length; i++) {          // liens entre les points proches
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance < LINK_DISTANCE) {
          ctx.strokeStyle = `rgba(${COLOR}, ${(1 - distance / LINK_DISTANCE) * 0.16})`; // plus proche = plus visible
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const node of this.nodes) {                       // liens vers la souris + points
      if (this.mouse) {
        const distance = Math.hypot(this.mouse.x - node.x, this.mouse.y - node.y);
        if (distance < MOUSE_DISTANCE) {
          ctx.strokeStyle = `rgba(${COLOR}, ${(1 - distance / MOUSE_DISTANCE) * 0.28})`;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(this.mouse.x, this.mouse.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = `rgba(${COLOR}, 0.55)`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
