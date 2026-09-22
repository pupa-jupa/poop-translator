export interface FloatingAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Point { x: number; y: number }
interface Size { width: number; height: number }

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

export function clampFloatingCardPosition(
  position: Point,
  size: Size,
  viewport: Size,
  margin = 12,
): Point {
  const visibleWidth = Math.min(size.width, Math.max(0, viewport.width - margin * 2));
  const visibleHeight = Math.min(size.height, Math.max(0, viewport.height - margin * 2));
  return {
    x: clamp(position.x, margin, viewport.width - visibleWidth - margin),
    y: clamp(position.y, margin, viewport.height - visibleHeight - margin),
  };
}

export function moveFloatingCardByKey(
  position: Point,
  key: string,
  fine: boolean,
  size: Size,
  viewport: Size,
): Point | undefined {
  const step = fine ? 1 : 10;
  const delta = {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  }[key];
  if (!delta) return undefined;
  return clampFloatingCardPosition(
    { x: position.x + delta.x, y: position.y + delta.y },
    size,
    viewport,
  );
}
