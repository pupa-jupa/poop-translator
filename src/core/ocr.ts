export function normalizeRecognizedText(value: string): string {
  return value
    .replace(/\f/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}
