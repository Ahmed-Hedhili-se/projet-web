import { clamp, easeOutCubic, latLonToUv, sampleStops, uvToSphere } from './planet-math';

describe('planet-math', () => {
  const stops = [
    { p: 0, v: 0 },
    { p: 0.5, v: 10 },
    { p: 1, v: 4 },
  ];

  it('should return the key values and move smoothly between them', () => {
    expect(sampleStops(stops, -1)).toBe(0);
    expect(sampleStops(stops, 0.5)).toBe(10);
    expect(sampleStops(stops, 2)).toBe(4);
    expect(sampleStops(stops, 0.25)).toBeCloseTo(5);
    expect(sampleStops(stops, 0.05)).toBeLessThan(1);
  });

  it('should ease and clamp', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(5)).toBe(1);
    expect(clamp(12, 0, 10)).toBe(10);
  });

  it('should place the north pole at the top of the sphere and the equator on its middle', () => {
    const pole = latLonToUv(90, 0);
    const top = uvToSphere(pole.u, pole.v, 2);
    expect(top.y).toBeCloseTo(2);
    const equator = latLonToUv(0, 0);
    const point = uvToSphere(equator.u, equator.v, 2);
    expect(point.y).toBeCloseTo(0);
    expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(2);
  });
});
