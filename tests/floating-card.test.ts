import { describe, expect, it } from 'vitest';
import { clampFloatingCardPosition, moveFloatingCardByKey, placeFloatingCard } from '../src/core/floating-card';

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

  it('clamps a manually moved card to every viewport edge', () => {
    expect(clampFloatingCardPosition(
      { x: 790, y: -20 }, { width: 350, height: 480 }, { width: 800, height: 600 }, 12,
    )).toEqual({ x: 438, y: 12 });
  });

  it('moves by keyboard with normal and fine steps', () => {
    const size = { width: 350, height: 300 };
    const viewport = { width: 800, height: 600 };
    expect(moveFloatingCardByKey({ x: 100, y: 100 }, 'ArrowRight', false, size, viewport))
      .toEqual({ x: 110, y: 100 });
    expect(moveFloatingCardByKey({ x: 100, y: 100 }, 'ArrowUp', true, size, viewport))
      .toEqual({ x: 100, y: 99 });
    expect(moveFloatingCardByKey({ x: 100, y: 100 }, 'Enter', false, size, viewport)).toBeUndefined();
  });
});
