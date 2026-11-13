# TeraMind — Motion & 3D (extension of DESIGN.md)

> **Scope.** This file adds motion, 3D and glass surfaces on top of `docs/DESIGN.md`.
> `DESIGN.md` stays the source of truth for **colors, fonts, type scale, radii, buttons and base components**.
> When the two disagree, DESIGN.md wins, except for the exceptions listed in section 1.
> Inspired by an immersive "planet landing page" brief, **adapted** to TeraMind: Angular, our palette, our content.

---

## 1. Approved exceptions to DESIGN.md

| DESIGN.md rule | Exception (and only this) |
|---|---|
| Plain black backgrounds | Fixed animated background on every page: starfield + faint grid + **3D planet** + **neural network** (section 3) |
| No shadows | Still no box shadows. Depth comes from the 3D scene, **glass blur** and 1px Steel borders |
| No gradients except Carbon → Obsidian | Allowed only **inside the WebGL scene** (halo, atmosphere, glints) and for the **hero top scrim** (`rgba(0,0,0,.8)` → transparent) that keeps the nav and title readable |
| Solid card surfaces | **Glass cards** allowed where content floats over the planet (section 5) |
| Monochrome UI (blue only for buttons) | **Aurora accent palette** (section 10): blue → violet → cyan, shifting with scroll and per page, for glows, icons, key figures, active links and the 3D scene. Buttons stay Action Blue pills |

Everything else in DESIGN.md is unchanged: Obsidian / Graphite / Carbon surfaces, Porcelain text, Ash secondary text,
**Action Blue `#0071e3` only for primary pills**, Electric Link `#2997ff` for links, Inter, 28px card radius, pill buttons.
**Not imported from the brief:** mint green accent, gradient buttons with glow shadows, gradient text fills, the "Ascend" content.

---

## 2. Concept — "the brain around the planet"

TeraMind = **an AI brain (the neural network) plugged into a worldwide GPU infrastructure (the planet)**.
The two animations are one scene telling that story:

- the **neural network** (existing, cursor-linked) floats *around* the planet like a constellation;
- the **planet** carries TeraMind's **data centers** as pulsing markers;
- the network **connects to** the data centers; **data packets** travel along links and make a data center ping.

---

## 3. Scene layers (back → front), all fixed behind the page, `pointer-events: none`, `aria-hidden`

| # | Layer | Tech | Notes |
|---|---|---|---|
| 1 | Obsidian background `#000000` + **starfield** + faint **grid** (existing `background-grid.svg`, kept, drifting) | WebGL points + CSS | Stars: Porcelain `#f5f5f7`, slow twinkle |
| 2 | **3D planet** (+ clouds, halo, data-center markers) | Three.js canvas | Section 4 |
| 3 | **Neural network** (existing `site-background.ts` logic, kept) | 2D canvas | Section 6 — now reads `SceneSync` |
| — | Vignette (existing `.site-vignette`) | CSS | Sits **between the grid and the planet**: it fades the grid at the edges without darkening the planet or the network |

One single background component lives in `app.html` and **never reloads between routes**, so the planet can glide between its hero and corner positions.

---

## 4. The planet (Three.js)

### Assets (local, offline-safe) — `frontend/public/textures/earth/` (see `CREDITS.md`)
`earth_atmos_2048.jpg` (day) · `earth_lights_2048.png` (city lights) · `earth_clouds_1024.png` · `earth_specular_2048.jpg` (**ocean mask**, white = water) · `earth_normal_2048.jpg` (relief).
Use `THREE.SphereGeometry` (no GLTF needed). Load textures with `TextureLoader`; set `colorSpace = SRGBColorSpace` on color maps.

### Look (adapted from the brief, using Three.js current API — `WebGLRenderer`, `outputColorSpace`, `onBeforeCompile`)
- **Day/night**: fixed sun direction `normalize(vec3(-0.9, 0.18, 0.4))` in view space; night side darkened ×0.08; **city lights** from `earth_lights` added on the night side (`nightLights ≈ 6–10`), warm white.
- **Oceans**: water mask from `earth_specular`; subtle simplex-noise shimmer + flow; **sun glint** `pow(n·h, 140)` × 0.45, warm white; deep-ocean tint `vec3(0.01, 0.06, 0.16)` × 0.12.
- **Relief**: `earth_normal` (or bump from luminance) × 0.33, land only.
- **Rim light**: Fresnel `pow(1 - n·v, 2.4)` mixed toward light blue **`#9fc4ff`** (Electric Link family) at 0.7.
- **Atmosphere halo**: additive billboard plane behind the planet, radial falloff `pow(1-d, 2.2)`, color = **current aurora color** (`SceneSync.frame.accent`, section 10; base `#3a6cff`), intensity ≈ 3 (WebGL-only gradient, allowed). The rim light follows the aurora color too, lightened.
- **Clouds**: 2 shells (desktop: 3) at radius ×1.005 / ×1.03 (/ ×1.075), opacity 0.6 / 0.5, spins 0.06 / 0.14 rad·s⁻¹, alpha modulated by simplex noise, darker on the night side.
- **Data-center markers**: ~40 points on **land only** (sample the ocean mask), point sprites: core + expanding **radar ring** (`fract(t·0.5 + seed)`), color **warm white `#fff1cf`** with **Optical Yellow `#ffd500`** ring at low alpha. **3 highlighted markers** = TeraMind's 3 data centers (slightly larger, brighter).
- **Starfield**: ~1400 points on a sphere r = 90, size 1.6, twinkle `0.6 + 0.4·sin(t + seed)`.
- **Ambient motes**: optional, desktop only, ≤ 200, very faint.
- **Post-processing**: one `UnrealBloomPass` (strength ≈ 0.5, radius 0.6, threshold 0) — **desktop only**. The brief's 3-composer chain and "corner flame" pass are **dropped** (too heavy for the benefit).
- Planet radius 1.95 world units, tilt 0.37 rad, base spin 0.03 rad·s⁻¹. Camera `PerspectiveCamera(40)` at z = 8.

### Two modes (driven by `SceneSync.mode`)
| Mode | Where | Behaviour |
|---|---|---|
| `hero` | Home (`/`) | Big planet, starts **low and huge** (half below the fold), **float-up entrance** 1.9 s (`easeOutCubic`, from y −6.5) once textures are loaded, then **scroll choreography** below |
| `corner` | every other page | **Small planet bottom-right** (on-screen radius ≈ 90–130 px, ~18 px from the edges, under the content), slow spin, no scroll travel, halo at 60 %, markers kept |

**Scroll choreography (hero)** — smoothstep keyframes on `SceneSync.frame.scrollProgress` (damped, `k = min(1, dt·3.2)`):
```
X: {0:0}  {0.32:-3.1} {0.64:3.2}  {1:0}      (× clamp(innerWidth/1200, 0.5, 1))
Y: {0:-4.75}{0.32:0.55} {0.64:0.45} {1:0.15}
S: {0:2.15}{0.32:1.0}  {0.64:0.92} {1:1.12}
rotation.y = 2.07 + spinPhase + progress·π·1.6
```
**Mode transitions**: when the route changes, damp position/scale from the current values to the new mode's target over ~1.2 s (no jump, no reload).

### Publishing to `SceneSync` (every frame)
Write `frame.planet = { x, y, radius }` (planet centre and visible radius **in CSS pixels**, projected with the camera) and `frame.markers = [...]` (screen positions of markers on the **visible** hemisphere). Write `frame.pulses` when a data packet arrives (section 6).

---

## 5. Pages & surfaces

### Home (hero mode)
- **Hero**: nav + title over the low planet. A **top scrim** `radial-gradient(125% 62% at 50% -10%, rgba(0,0,0,.82) 0%, rgba(0,0,0,.28) 44%, transparent 68%)` keeps text readable. Hero content shifted up (`translateY(-8vh)`); existing `SplitText` title, capsule + pills kept.
- **Sections float over the planet**: keep the existing Home sections and order; remove opaque full-width bands where they hide the scene.
- Remove the static hero GPU image on Home if it competes with the planet (keep it on other pages).

### Glass cards (where content floats over the scene)
```
background: rgba(22, 22, 24, .66)   /* dark Carbon at 66 % — darker than first planned so text stays ≥ 4.5:1 over the bright day side */
backdrop-filter: blur(14px) saturate(120%)
border: 1px solid rgba(51, 51, 54, .8)   /* Steel */
border-radius: 28px                      /* DESIGN.md card radius */
hover: background rgba(22,22,24,.76), border Slate mixed with 35 % aurora, translateY(-4px)
mobile / coarse pointer: no blur, background at 86 %
secondary text inside glass: Porcelain at 70 % (Ash is too dim over the planet)
```
No box shadow. A very faint **top-left sheen** (`radial-gradient(120% 120% at 0% 0%, rgba(245,245,247,.05), transparent 45%)`) may fade in on hover.
Forms, tables and admin screens keep **solid** Carbon/Obsidian surfaces (readability first).

### Other pages (corner mode)
Layout unchanged. The small planet sits bottom-right under the content; the network keeps the leading role.

---

## 6. Synchronisation planet ⇄ neural network (`SceneSync`, `core/services/scene-sync.ts`)

`SceneSync` already provides: `mode` (signal), `reduceMotion`, and `frame` = `{ pointer, scrollProgress, planet, markers, pulses }`
(plain object mutated every frame — **not** a signal, so Angular does not re-render 60 times per second).

Rules the neural network canvas must follow:
1. **Avoid the planet**: nodes inside `planet.radius + 24px` are pushed outward softly (they orbit around the silhouette, never cross the globe). No links drawn across the planet disk.
2. **Plug into the planet**: nodes within ~70 px of a visible **marker** draw a link to it (Porcelain, alpha ≤ 0.35).
3. **Cursor** (kept as today): attraction + links to the cursor. Additionally the planet **tilts toward the cursor** (max ±0.08 rad, damped) and the marker nearest to the cursor **pings**.
4. **Data packets**: every 1.2–2.5 s a small bright dot travels along a chain of 2–4 links ending on a marker (≈ 0.8 s per link); on arrival push the marker into `frame.pulses` → the planet plays a stronger radar ring on it.
5. **Density follows scroll (hero)**: network alpha/count ramps from ~60 % at the top of Home to 100 % from `scrollProgress ≥ 0.3`. Corner mode: 100 %.
6. **One palette**: nodes/links Porcelain; "active" links (to markers, to the cursor) and **data packets** take the **current aurora color** (section 10); markers warm white/Optical Yellow. A few nodes (≈ 15 %) are tinted with the aurora color at low alpha so the network itself shimmers.

---

## 7. Motion system

| Token | Value | Use |
|---|---|---|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` (existing) | reveals, entrances |
| Reveal | existing `appReveal` (fade-up 32px, 0.9 s) + per-item delay | sections, cards |
| Hero sequence | title 60 ms · subtitle 180 ms · actions 300 ms · next block 420 ms | first paint |
| Smooth scroll | **Lenis** `{ duration: 1.15, smoothWheel: true, touchMultiplier: 1.5 }`, rAF-driven | whole site |
| Planet entrance | 1.9 s, `1-(1-t)^3`, from y −6.5 | once, hero mode |
| Mode glide | ~1.2 s damped | route change |

Existing effects stay: SplitText, ScrollText, CountUp, Tilt, scroll-driven CSS (zoom, parallax, highlight, draw), marquee, view transitions.
Lenis must not break: anchored scroll-to-top on navigation (`withInMemoryScrolling`), `position: sticky`, scroll-driven CSS animations (verify), drawers/dialogs (`data-lenis-prevent` on scrollable panels).

---

## 8. Performance & accessibility (non-negotiable)

- **Lazy-load Three.js** (`await import('three')` inside the background component) so it is not in the initial bundle.
- **DPR cap** 1.5 (desktop) / 1.25 (mobile). Pause rendering when `document.hidden`.
- **Mobile / coarse pointer / width < 768 px**: no bloom, 2 cloud shells, 1 000 stars, ≤ 24 markers, network count halved, sphere 64×64 segments.
- **`prefers-reduced-motion`**: no Lenis, no entrance, no scroll travel, render **one static frame** of the planet, static network.
- **No WebGL / texture error**: hide the planet layer; the neural network and grid alone remain (current behaviour).
- Canvases are `aria-hidden`, never focusable, never capture pointer or scroll. Text contrast over the scene must stay ≥ 4.5:1 (scrim + glass + vignette).
- Target: 60 fps on a mid-range laptop; no layout shift when the scene loads.

---

## 9. Implementation map (suggested files)

| File | Role |
|---|---|
| `core/services/scene-sync.ts` | ✅ exists — shared state (mode, pointer, scroll, planet, markers, pulses) |
| `layout/site-background/planet-scene.ts` | **new** — plain TypeScript class wrapping Three.js (init, resize, setMode, render loop, dispose); no Angular inside |
| `layout/site-background/planet-shaders.ts` | **new** — GLSL strings (simplex noise, planet, clouds, halo, stars, markers) |
| `layout/site-background/site-background.ts/.html` | **update** — adds the 3D canvas under the network canvas, lazy-loads `PlanetScene`, network reads `SceneSync` (rules of section 6) |
| `core/services/smooth-scroll.ts` | **new** — Lenis start/stop (respects reduced motion) |
| `pages/public/home/*` | **update** — hero over the planet, glass cards, remove opaque bands |
| `styles.css` | **update** — `.glass-card`, hero scrim, Lenis base CSS |

Tests: jsdom has no WebGL — keep the `navigator.userAgent.includes('jsdom')` guard and test `SceneSync` + pure helpers (keyframe sampling, land sampling) only.

---

## 10. Color — the "Aurora" accent palette (approved)

Black-and-white everywhere is not inviting enough. TeraMind gets a **living accent color** that shifts slowly,
on top of the unchanged DESIGN.md base (Obsidian / Carbon surfaces, Porcelain text, Action Blue pill buttons).

### Palette

| Token | Glow / fill | Text-safe variant (on Carbon ≥ 4.5 : 1) | Role |
|---|---|---|---|
| `--aurora-blue` | `#2997ff` | `#2997ff` (5.6 : 1) | start of the journey, catalog |
| `--aurora-violet` | `#8b5cf6` | `#a78bfa` (6.2 : 1) | middle, recommendation, AI |
| `--aurora-cyan` | `#22d3ee` | `#22d3ee` (9.3 : 1) | end of the journey, contact, success |
| `--aurora` | *current interpolated color* | — | written by JS on `:root`, used everywhere below |

Implementation: `SceneSync.tickAccent()` writes `--aurora` (vivid, for glows) and `--aurora-text` (the same color lightened 35 % toward white,
always ≥ 4.5 : 1 on Obsidian and Carbon). Tailwind classes: `text-aurora` (text) and `*-aurora-glow` (glows, icons, gauges).

Rules: accent colors are **never** used for body text or button fills. Text may use the text-safe variants only for
**short highlights** (key figures, eyebrow labels, the highlighted word of a title). Buttons stay Action Blue pills.

### How the color changes
- **Home (scroll)**: `scrollProgress` 0 → 0.5 → 1 maps blue → violet → cyan (smooth interpolation in OKLab or linear RGB, damped like the planet).
- **Per page** (corner mode), a fixed tint, blended in ~1.2 s on route change:
  `/gpus` & `/gpus/:id` blue · `/recommend` violet · `/about` blue→violet (by scroll) · `/contact` cyan ·
  `/login`, `/register` violet · `/account/*` blue · `/admin/*` cyan.
- `SceneSync` exposes the current color as `frame.accent` (`{ r, g, b }`, 0–1) and writes `--aurora` (and `--aurora-rgb`)
  on `document.documentElement` **at most ~10 times per second** (no Angular re-render).
- Reduced motion: no interpolation over time — the color jumps to the page tint.

### Where the color appears
| Element | Treatment |
|---|---|
| 3D scene | Planet halo + rim light; star twinkle slightly tinted; data-packet trails |
| Neural network | Active links (cursor, markers), packets, ~15 % tinted nodes |
| Section glow | A very soft radial light behind each section: `radial-gradient(60% 50% at 50% 0%, rgb(var(--aurora-rgb) / .10), transparent 70%)` |
| Glass cards | On hover: 1px border mixes toward `--aurora` (35 %), faint aurora sheen top-left (8 %) |
| Icons | Icon stroke in `--aurora`; icon bubble background `rgb(var(--aurora-rgb) / .12)` |
| Key figures (CountUp, stats, prices in the hero) | Text-safe aurora variant |
| Eyebrow labels (small titles above headings) | Text-safe aurora variant |
| Highlighted word in a hero title | Text-safe aurora variant (solid color, no gradient text) |
| Progress bars, gauges, chart bars (dashboard, recommendation) | Fill in `--aurora` instead of Porcelain |
| Status badges | Unchanged (Porcelain / Ash) — states must stay readable |

Stay subtle: glows ≤ 12 % opacity, never a saturated block of color behind text.
