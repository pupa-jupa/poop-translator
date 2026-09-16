import { describe, expect, it, vi } from 'vitest';
import {
  PageTranslationSession,
  collectTextNodes,
  splitText,
} from '../src/core/page-translation';

describe('page translation helpers', () => {
  it('collects readable content and skips code, forms, hidden and extension UI', () => {
    document.body.innerHTML = `
      <main>
        <p>Hello <strong>world</strong></p>
        <pre>const secret = true</pre>
        <label>Name <input value="John"></label>
        <p hidden>Hidden sentence</p>
        <div data-poop-translator-root>Extension text</div>
      </main>`;

    const texts = collectTextNodes(document.querySelector('main')!).map((node) => node.data.trim());

    expect(texts).toEqual(['Hello', 'world']);
  });

  it('splits long text near sentence boundaries without losing characters', () => {
    const source = 'First sentence. Second sentence is longer. Third.';

    const chunks = splitText(source, 24);

    expect(chunks).toEqual(['First sentence.', 'Second sentence is', 'longer. Third.']);
    expect(chunks.join(' ')).toBe(source);
  });
});

describe('PageTranslationSession', () => {
  it('does not rewrite or snapshot text already on the target language', async () => {
    document.body.innerHTML = '<main><p>  Уже по-русски   здесь.  </p></main>';
    const node = document.querySelector('p')!.firstChild as Text;
    const original = node.data;
    const session = new PageTranslationSession();
    await session.translate(document.querySelector('main')!, async (text) => text);
    expect(node.data).toBe(original);
    expect(session.translatedNodeCount).toBe(0);
  });
  it('translates nodes, reports progress and restores untouched translations', async () => {
    document.body.innerHTML = '<main><p>Hello world.</p><p>Nice day.</p></main>';
    const main = document.querySelector('main')!;
    const translate = vi.fn(async (text: string) => `RU:${text}`);
    const progress: Array<[number, number]> = [];
    const session = new PageTranslationSession(30);

    const summary = await session.translate(main, translate, (done, total) => progress.push([done, total]));

    expect(main.textContent).toBe('RU:Hello world.RU:Nice day.');
    expect(summary).toEqual({ completed: 2, total: 2, failed: 0 });
    expect(progress).toEqual([[1, 2], [2, 2]]);

    const firstText = main.querySelector('p')!.firstChild as Text;
    firstText.data = 'Site changed this text';
    session.restore();

    expect(main.textContent).toBe('Site changed this textNice day.');
  });

  it('stops before the next node when aborted', async () => {
    document.body.innerHTML = '<main><p>One.</p><p>Two.</p></main>';
    const controller = new AbortController();
    const session = new PageTranslationSession();
    let calls = 0;

    const operation = session.translate(document.querySelector('main')!, async (text) => {
      calls += 1;
      controller.abort();
      return `RU:${text}`;
    }, undefined, controller.signal);

    await expect(operation).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toBe(1);
    expect(document.querySelector('main')?.textContent).toBe('One.Two.');
  });

  it('does not overwrite a node changed by the site while translation is pending', async () => {
    document.body.innerHTML = '<main><p>Hello.</p></main>';
    const node = document.querySelector('p')!.firstChild as Text;
    const session = new PageTranslationSession();
    let release: ((value: string) => void) | undefined;

    const pending = session.translate(document.querySelector('main')!, () => new Promise((resolve) => {
      release = resolve;
    }));
    node.data = 'Fresh site content.';
    release?.('Привет.');
    await pending;

    expect(node.data).toBe('Fresh site content.');
    expect(session.translatedNodeCount).toBe(0);
  });
});
