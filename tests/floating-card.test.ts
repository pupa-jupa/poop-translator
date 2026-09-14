import { describe, expect, it } from 'vitest';
import { placeFloatingCard } from '../src/core/floating-card';

describe('placeFloatingCard', () => {
  it('opens a tall card above a selection near the bottom edge', () => {
    expect(placeFloatingCard({
      anchor: { left: 120, top: 710, right: 210, bottom: 735 },
      cardWidth: 350,
      cardHeight: 360,
      viewportWidth: 800,
      viewportHeight: 768,
    })).toEqual({ left: 120, top: 340 });
  });

  it('keeps a growing card fully inside a small viewport', () => {
    expect(placeFloatingCard({
      anchor: { left: 760, top: 310, right: 790, bottom: 330 },
      cardWidth: 350,
      cardHeight: 500,
      viewportWidth: 800,
      viewportHeight: 360,
    })).toEqual({ left: 438, top: 12 });
  });

  it('opens below when the selection has enough room', () => {
    expect(placeFloatingCard({
      anchor: { left: 20, top: 20, right: 80, bottom: 40 },
      cardWidth: 350,
      cardHeight: 200,
      viewportWidth: 800,
      viewportHeight: 768,
    })).toEqual({ left: 20, top: 50 });
  });
});
