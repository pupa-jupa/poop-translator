import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createWorker: vi.fn() }));
vi.mock('tesseract.js', () => ({
  createWorker: mocks.createWorker, OEM: { LSTM_ONLY: 1 }, PSM: { SPARSE_TEXT: '11' },
}));

describe('local OCR fallback lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(), putImageData: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) }),
    } as unknown as CanvasRenderingContext2D);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('does not add a second pass to confident plain text', async () => {
    const recognize = vi.fn().mockResolvedValue({ data: { text: 'HELLO OCR', confidence: 95 } });
    mocks.createWorker.mockResolvedValue({ recognize, setParameters: vi.fn() });
    const { recognizeCanvas } = await import('../src/ocr/tesseract-engine');
    expect(await recognizeCanvas(document.createElement('canvas'), ['eng']))
      .toEqual({ text: 'HELLO OCR', confidence: 95 });
    expect(recognize).toHaveBeenCalledTimes(1);
  });

  it('retries uncertain text with the photo mask and keeps confident lines', async () => {
    const recognize = vi.fn()
      .mockResolvedValueOnce({ data: { text: 'D) Ta', confidence: 30 } })
      .mockResolvedValueOnce({ data: { blocks: [{ paragraphs: [{ lines: [
        { text: 'Read this image', confidence: 93 }, { text: 'D)', confidence: 90 },
      ] }] }] } });
    mocks.createWorker.mockResolvedValue({ recognize, setParameters: vi.fn() });
    const { recognizeCanvas } = await import('../src/ocr/tesseract-engine');
    expect(await recognizeCanvas(document.createElement('canvas'), ['eng']))
      .toEqual({ text: 'Read this image', confidence: 93 });
    expect(recognize).toHaveBeenCalledTimes(2);
  });

  it('preserves recognized text if the optional second pass fails', async () => {
    const recognize = vi.fn()
      .mockResolvedValueOnce({ data: { text: 'Some text', confidence: 50 } })
      .mockRejectedValueOnce(new Error('Worker stopped'));
    const terminate = vi.fn().mockResolvedValue(undefined);
    mocks.createWorker.mockResolvedValue({ recognize, setParameters: vi.fn(), terminate });
    const { recognizeCanvas } = await import('../src/ocr/tesseract-engine');
    expect(await recognizeCanvas(document.createElement('canvas'), ['eng']))
      .toEqual({ text: 'Some text', confidence: 50 });
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('replaces the active worker when the selected OCR model changes', async () => {
    const firstTerminate = vi.fn().mockResolvedValue(undefined);
    mocks.createWorker
      .mockResolvedValueOnce({ recognize: vi.fn().mockResolvedValue({ data: { text: '日本語', confidence: 95 } }), setParameters: vi.fn(), terminate: firstTerminate })
      .mockResolvedValueOnce({ recognize: vi.fn().mockResolvedValue({ data: { text: '한국어', confidence: 95 } }), setParameters: vi.fn(), terminate: vi.fn() });
    const { recognizeCanvas } = await import('../src/ocr/tesseract-engine');

    await recognizeCanvas(document.createElement('canvas'), ['jpn']);
    await recognizeCanvas(document.createElement('canvas'), ['kor']);

    expect(firstTerminate).toHaveBeenCalledOnce();
    expect(mocks.createWorker).toHaveBeenNthCalledWith(1, ['jpn'], expect.anything(), expect.anything());
    expect(mocks.createWorker).toHaveBeenNthCalledWith(2, ['kor'], expect.anything(), expect.anything());
  });

  it('serializes a language switch while the previous model is still loading', async () => {
    let releaseFirst: ((worker: unknown) => void) | undefined;
    const first = { recognize: vi.fn().mockResolvedValue({ data: { text: '日本語', confidence: 95 } }), setParameters: vi.fn(), terminate: vi.fn().mockResolvedValue(undefined) };
    const second = { recognize: vi.fn().mockResolvedValue({ data: { text: '한국어', confidence: 95 } }), setParameters: vi.fn(), terminate: vi.fn().mockResolvedValue(undefined) };
    mocks.createWorker
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
      .mockResolvedValueOnce(second);
    const { recognizeCanvas } = await import('../src/ocr/tesseract-engine');
    const canvas = document.createElement('canvas');
    const japanese = recognizeCanvas(canvas, ['jpn']);
    const korean = recognizeCanvas(canvas, ['kor']);
    await Promise.resolve();
    expect(mocks.createWorker).toHaveBeenCalledTimes(1);
    releaseFirst?.(first);
    await Promise.all([japanese, korean]);
    expect(first.terminate).toHaveBeenCalledOnce();
    expect(mocks.createWorker).toHaveBeenCalledTimes(2);
  });
});
