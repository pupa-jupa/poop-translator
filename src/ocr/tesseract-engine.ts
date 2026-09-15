import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { normalizeRecognizedText } from '../core/ocr';
import type { OcrLanguage, OcrRecognitionResult } from '../shared/types';

let activeWorker: Worker | undefined;
let activeLanguages = '';
let pendingWorker: Promise<Worker> | undefined;

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

export async function recognizeCanvas(
  canvas: HTMLCanvasElement,
  languages: OcrLanguage[],
): Promise<OcrRecognitionResult> {
  const worker = await getWorker(languages);
  try {
    const result = await worker.recognize(canvas);
    return {
      text: normalizeRecognizedText(result.data.text),
      confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : 0,
    };
  } catch (error) {
    await worker.terminate().catch(() => undefined);
    activeWorker = undefined;
    activeLanguages = '';
    throw error;
  }
}
