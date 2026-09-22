import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { maskLightText, normalizeRecognizedText, selectOcrResult } from '../core/ocr';
import type { OcrLanguage, OcrRecognitionResult } from '../shared/types';

let activeWorker: Worker | undefined;
let activeLanguages = '';
let pendingWorker: Promise<Worker> | undefined;
let recognitionTail: Promise<void> = Promise.resolve();

function prepareLightText(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const prepared = document.createElement('canvas');
  // Bound additional pixel buffers for large captures, and enlarge small lettering.
  const scale = Math.min(2, 2400 / Math.max(canvas.width, canvas.height),
    Math.sqrt(4_000_000 / (canvas.width * canvas.height)));
  prepared.width = Math.max(1, Math.round(canvas.width * scale));
  prepared.height = Math.max(1, Math.round(canvas.height * scale));
  const context = prepared.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Не удалось подготовить светлый текст');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(canvas, 0, 0, prepared.width, prepared.height);
  const pixels = context.getImageData(0, 0, prepared.width, prepared.height);
  maskLightText(pixels.data);
  context.putImageData(pixels, 0, 0);
  return prepared;
}

async function createOcrWorker(languages: OcrLanguage[]): Promise<Worker> {
  const worker = await createWorker(languages, OEM.LSTM_ONLY, {
    workerPath: chrome.runtime.getURL('ocr/worker.min.js'),
    langPath: chrome.runtime.getURL('ocr/lang'),
    corePath: chrome.runtime.getURL('ocr/core'),
    workerBlobURL: false,
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    preserve_interword_spaces: '1',
    user_defined_dpi: '150',
  });
  return worker;
}

async function getWorker(languages: OcrLanguage[]): Promise<Worker> {
  const key = [...languages].sort().join('+');
  if (activeWorker && activeLanguages === key) return activeWorker;
  if (pendingWorker && activeLanguages === key) return pendingWorker;

  if (activeWorker) {
    await activeWorker.terminate();
    activeWorker = undefined;
  }
  activeLanguages = key;
  pendingWorker = createOcrWorker(key.split('+') as OcrLanguage[]);
  try {
    activeWorker = await pendingWorker;
    return activeWorker;
  } catch (error) {
    activeLanguages = '';
    throw error;
  } finally {
    pendingWorker = undefined;
  }
}

async function recognizeCanvasOnce(
  canvas: HTMLCanvasElement,
  languages: OcrLanguage[],
): Promise<OcrRecognitionResult> {
  const worker = await getWorker(languages);
  try {
    const result = await worker.recognize(canvas);
    const original = {
      text: normalizeRecognizedText(result.data.text),
      confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : 0,
    };
    if (original.confidence >= 80) return original;
    let prepared: HTMLCanvasElement | undefined;
    try {
      prepared = prepareLightText(canvas);
      const alternative = await worker.recognize(prepared, {}, { text: true, blocks: true });
      const lines = alternative.data.blocks?.flatMap((block) => block.paragraphs.flatMap(
        (paragraph) => paragraph.lines.map((line) => ({ text: line.text, confidence: line.confidence })),
      )) ?? [];
      return selectOcrResult(original, lines);
    } catch {
      await worker.terminate().catch(() => undefined);
      activeWorker = undefined;
      activeLanguages = '';
      return original;
    } finally {
      if (prepared) prepared.width = prepared.height = 1;
    }
  } catch (error) {
    await worker.terminate().catch(() => undefined);
    activeWorker = undefined;
    activeLanguages = '';
    throw error;
  }
}

export function recognizeCanvas(
  canvas: HTMLCanvasElement,
  languages: OcrLanguage[],
): Promise<OcrRecognitionResult> {
  // One OCR job may own the worker at a time. A rapid language switch waits
  // until recognition finishes before replacing the traineddata in memory.
  const job = recognitionTail.then(() => recognizeCanvasOnce(canvas, languages));
  recognitionTail = job.then(() => undefined, () => undefined);
  return job;
}
