import type { BitmapRegion, Point, RegionRect, Size } from '../shared/types';

const MIN_REGION_SIZE = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeRegionSelection(start: Point, end: Point, viewport: Size): RegionRect | null {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)
    || viewport.width <= 0 || viewport.height <= 0) return null;

  const startX = clamp(start.x, 0, viewport.width);
  const startY = clamp(start.y, 0, viewport.height);
  const endX = clamp(end.x, 0, viewport.width);
  const endY = clamp(end.y, 0, viewport.height);
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  if (width < MIN_REGION_SIZE || height < MIN_REGION_SIZE) return null;
  return { left, top, width, height, viewportWidth: viewport.width, viewportHeight: viewport.height };
}

export function mapRegionToBitmap(region: RegionRect, bitmap: Size): BitmapRegion {
  const scaleX = bitmap.width / region.viewportWidth;
  const scaleY = bitmap.height / region.viewportHeight;
  const left = clamp(Math.floor(region.left * scaleX), 0, bitmap.width);
  const top = clamp(Math.floor(region.top * scaleY), 0, bitmap.height);
  const right = clamp(Math.ceil((region.left + region.width) * scaleX), left, bitmap.width);
  const bottom = clamp(Math.ceil((region.top + region.height) * scaleY), top, bitmap.height);
  return { left, top, width: right - left, height: bottom - top };
}
