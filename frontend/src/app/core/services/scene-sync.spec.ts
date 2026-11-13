import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { RGB, SceneSync, auroraForPage, auroraForProgress } from './scene-sync';

@Component({ template: '' })
class EmptyPage {}                                         // page vide, juste pour naviguer

const hex = (c: RGB) =>                                    // couleur → "#rrggbb" (évite les erreurs d'arrondi des nombres à virgule)
  '#' + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

describe('SceneSync', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: EmptyPage }, { path: 'gpus', component: EmptyPage }])],
    });
  });

  it('should use the hero planet on Home and the corner planet elsewhere', async () => {
    const sync = TestBed.inject(SceneSync);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/');
    expect(sync.mode()).toBe('hero');

    await router.navigateByUrl('/gpus?minVram=40');
    expect(sync.mode()).toBe('corner');                    // la query string est ignorée
  });

  it('should give each page its aurora tint and follow the scroll on Home', () => {
    const blue = auroraForPage('/gpus', 0);
    const violet = auroraForPage('/recommend', 0);
    const cyan = auroraForPage('/contact', 0);
    expect(Math.round(blue.b * 255)).toBe(0xff);           // #2997ff
    expect(Math.round(violet.r * 255)).toBe(0x8b);         // #8b5cf6
    expect(Math.round(cyan.g * 255)).toBe(0xd3);           // #22d3ee
    expect(hex(auroraForPage('/', 0))).toBe(hex(blue));    // haut de Home : bleu
    expect(hex(auroraForPage('/', 1))).toBe(hex(cyan));    // bas de Home : cyan
    expect(hex(auroraForProgress(0.5))).toBe(hex(violet)); // milieu : violet
  });

  it('should glide the accent toward the page tint and write the CSS variables', async () => {
    const sync = TestBed.inject(SceneSync);
    await TestBed.inject(Router).navigateByUrl('/gpus');
    sync.tickAccent(10);                                   // grand dt : la couleur atteint la cible
    expect(hex(sync.frame.accent)).toBe('#2997ff');
    expect(document.documentElement.style.getPropertyValue('--aurora-rgb')).toBe('41 151 255');
  });

  it('should start with an empty frame until the 3D scene writes into it', () => {
    const sync = TestBed.inject(SceneSync);
    expect(sync.frame.planet).toBeNull();
    expect(sync.frame.markers).toEqual([]);
    expect(sync.frame.scrollProgress).toBeGreaterThanOrEqual(0);
  });
});
