import { mapRegionToBitmap } from '../core/region-capture';
import { isOcrRecognitionRequest, type RuntimeResponse } from '../shared/messages';
import type { OcrRecognitionResult } from '../shared/types';
import { recognizeCanvas } from './tesseract-engine';

let recognitionQueue: Promise<void> = Promise.resolve();

async function cropCapture(imageDataUrl: string, region: Parameters<typeof mapRegionToBitmap>[0]): Promise<HTMLCanvasElement> {
  const response = await fetch(imageDataUrl);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const crop = mapRegionToBitmap(region, { width: bitmap.width, height: bitmap.height });
    if (crop.width < 1 || crop.height < 1) throw new Error('Выбранная область слишком мала');
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Не удалось подготовить изображение для распознавания');
    context.drawImage(
      bitmap,
      crop.left,
      crop.top,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );
    return canvas;
  } finally {
    bitmap.close();
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: RuntimeResponse<OcrRecognitionResult>) => void) => {
  if (!isOcrRecognitionRequest(message)) return false;
  const task = recognitionQueue
    .then(() => cropCapture(message.imageDataUrl, message.region))
    .then((canvas) => recognizeCanvas(canvas, message.languages))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось распознать текст',
    }));
  recognitionQueue = task.then(() => undefined, () => undefined);
  return true;
});
