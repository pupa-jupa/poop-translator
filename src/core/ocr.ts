import type { OcrRecognitionResult } from '../shared/types';

export function maskLightText(pixels: Uint8ClampedArray): void {
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const luminance = pixels[i]! * 0.2126 + pixels[i + 1]! * 0.7152 + pixels[i + 2]! * 0.0722;
    const value = luminance >= 240 ? 0 : 255;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
    pixels[i + 3] = 255;
  }
}

export function selectOcrResult(
  original: OcrRecognitionResult,
  alternativeLines: OcrRecognitionResult[],
): OcrRecognitionResult {
  const lines = alternativeLines.filter((line) => line.confidence >= 75
    && (line.text.match(/\p{L}/gu)?.length ?? 0) >= 3);
  if (!lines.length) return original;
  const text = normalizeRecognizedText(lines.map((line) => line.text).join('\n'));
  const letterCount = (value: string) => value.match(/\p{L}/gu)?.length ?? 0;
  // A few confident labels must not replace a whole paragraph of uncertain text.
  if (letterCount(text) < letterCount(original.text) * 0.65) return original;
  const totalLength = lines.reduce((sum, line) => sum + line.text.trim().length, 0);
  const confidence = lines.reduce((sum, line) => sum + line.confidence * line.text.trim().length, 0) / totalLength;
  if (confidence < original.confidence + 10) return original;
  return { text, confidence };
}

export function normalizeRecognizedText(value: string): string {
  return value
    .replace(/\f/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}
