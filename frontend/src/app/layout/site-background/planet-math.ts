export interface Stop {
  // image clé : à la progression p, la valeur vaut v
  p: number;
  v: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function easeOutCubic(t: number): number {
  // rapide au début, lent à la fin (t de 0 à 1)
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
}

export function sampleStops(stops: Stop[], p: number): number {
  // valeur à la progression p, avec une transition douce entre deux images clés
  if (p <= stops[0].p) {
    return stops[0].v;
  }
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i].p) {
      const from = stops[i - 1];
      const to = stops[i];
      const t = (p - from.p) / (to.p - from.p); // 0 → 1 entre les deux images clés
      const smooth = t * t * (3 - 2 * t); // « smoothstep » : départ et arrivée en douceur
      return from.v + (to.v - from.v) * smooth;
    }
  }
  return stops[stops.length - 1].v;
}

export function latLonToUv(lat: number, lon: number): { u: number; v: number } {
  // latitude / longitude (degrés) → position sur la texture
  return { u: (lon + 180) / 360, v: (lat + 90) / 180 };
}

export function uvToSphere(
  u: number,
  v: number,
  radius: number,
): { x: number; y: number; z: number } {
  const phi = u * Math.PI * 2; // même convention que THREE.SphereGeometry
  const theta = (1 - v) * Math.PI;
  return {
    x: -radius * Math.cos(phi) * Math.sin(theta),
    y: radius * Math.cos(theta),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}
