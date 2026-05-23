import { describe, expect, it } from 'vitest';

import type { MapMetadata } from '../types';
import { pixelToWorld, worldToPixel } from './coordinates';

const baseMap: MapMetadata = {
  image: 'floor.pgm',
  mode: 'trinary',
  resolution: 0.05,
  origin: [0, 0, 0],
  negate: 0,
  occupied_thresh: 0.65,
  free_thresh: 0.25,
  width: 200,
  height: 100,
  frame_id: 'map',
};

describe('coordinate conversion', () => {
  it('round trips zero-origin maps', () => {
    const world = pixelToWorld({ px: 20, py: 30 }, baseMap);
    const pixel = worldToPixel(world, baseMap);

    expect(pixel.px).toBeCloseTo(20);
    expect(pixel.py).toBeCloseTo(30);
  });

  it('handles nonzero origin and resolution', () => {
    const metadata = { ...baseMap, resolution: 0.1, origin: [-12.4, -8.7, 0] as [number, number, number], height: 150 };
    const world = pixelToWorld({ px: 10, py: 20 }, metadata);

    expect(world.x).toBeCloseTo(-11.4);
    expect(world.y).toBeCloseTo(4.3);
  });

  it('round trips yawed map origins', () => {
    const metadata = { ...baseMap, origin: [2, -3, Math.PI / 6] as [number, number, number], resolution: 0.2 };
    const world = pixelToWorld({ px: 12.5, py: 42.25 }, metadata);
    const pixel = worldToPixel(world, metadata);

    expect(pixel.px).toBeCloseTo(12.5);
    expect(pixel.py).toBeCloseTo(42.25);
  });
});
