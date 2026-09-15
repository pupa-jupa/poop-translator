import { describe, expect, it } from 'vitest';
import { mapRegionToBitmap, normalizeRegionSelection } from '../src/core/region-capture';

describe('region capture geometry', () => {
  it('normalizes reverse dragging and keeps the region inside the viewport', () => {
    expect(normalizeRegionSelection(
      { x: 500, y: 300 },
      { x: 100, y: 50 },
      { width: 800, height: 600 },
    )).toEqual({
      left: 100,
      top: 50,
      width: 400,
      height: 250,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(normalizeRegionSelection(
      { x: -50, y: -20 },
      { x: 900, y: 700 },
      { width: 800, height: 600 },
    )).toEqual({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      viewportWidth: 800,
      viewportHeight: 600,
    });
  });

  it('rejects an accidental click instead of capturing a tiny region', () => {
    expect(normalizeRegionSelection(
      { x: 10, y: 10 },
      { x: 18, y: 18 },
      { width: 800, height: 600 },
    )).toBeNull();
  });

  it('maps CSS pixels to the actual screenshot bitmap without overflow', () => {
    expect(mapRegionToBitmap({
      left: 100,
      top: 50,
      width: 400,
      height: 250,
      viewportWidth: 800,
      viewportHeight: 600,
    }, { width: 1600, height: 1200 })).toEqual({
      left: 200,
      top: 100,
      width: 800,
      height: 500,
    });
  });
});
