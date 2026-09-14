export interface FloatingAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface FloatingCardPlacement {
  anchor?: FloatingAnchor;
  cardWidth: number;
  cardHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
  gap?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function placeFloatingCard({
  anchor,
  cardWidth,
  cardHeight,
  viewportWidth,
  viewportHeight,
  margin = 12,
  gap = 10,
}: FloatingCardPlacement): { left: number; top: number } {
  const visibleWidth = Math.min(cardWidth, Math.max(0, viewportWidth - margin * 2));
  const visibleHeight = Math.min(cardHeight, Math.max(0, viewportHeight - margin * 2));
  const left = clamp(anchor?.left ?? (viewportWidth - visibleWidth) / 2, margin, viewportWidth - visibleWidth - margin);
  if (!anchor) {
    return { left, top: clamp((viewportHeight - visibleHeight) / 2, margin, viewportHeight - visibleHeight - margin) };
  }

  const roomAbove = anchor.top - gap - margin;
  const roomBelow = viewportHeight - anchor.bottom - gap - margin;
  const openAbove = roomBelow < visibleHeight && roomAbove > roomBelow;
  const preferredTop = openAbove
    ? anchor.top - gap - visibleHeight
    : anchor.bottom + gap;
  return {
    left,
    top: clamp(preferredTop, margin, viewportHeight - visibleHeight - margin),
  };
}
