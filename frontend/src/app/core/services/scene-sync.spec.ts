import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { RGB, SceneSync, auroraForPage, auroraForProgress } from './scene-sync';

@Component({ template: '' })
class EmptyPage {}

const hex = (c: RGB) =>
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
    expect(sync.mode()).toBe('corner');
  });

  it('should give each page its aurora tint and follow the scroll on Home', () => {
    const blue = auroraForPage('/gpus', 0);
    const violet = auroraForPage('/recommend', 0);
    const cyan = auroraForPage('/contact', 0);
    expect(Math.round(blue.b * 255)).toBe(0xff);
    expect(Math.round(violet.r * 255)).toBe(0x8b);
    expect(Math.round(cyan.g * 255)).toBe(0xd3);
    expect(hex(auroraForPage('/', 0))).toBe(hex(blue));
    expect(hex(auroraForPage('/', 1))).toBe(hex(cyan));
    expect(hex(auroraForProgress(0.5))).toBe(hex(violet));
  });

  it('should glide the accent toward the page tint and write the CSS variables', async () => {
    const sync = TestBed.inject(SceneSync);
    await TestBed.inject(Router).navigateByUrl('/gpus');
    sync.tickAccent(10);
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
