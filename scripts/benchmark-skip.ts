import { JSDOM } from 'jsdom';

const SKIPPED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'FORM', 'LABEL', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'BUTTON', 'SVG', 'CANVAS',
]);

function isSkippedElementOriginal(element: Element | null): boolean {
  for (let current = element; current; current = current.parentElement) {
    if (SKIPPED_TAGS.has(current.tagName)) return true;
    if (current.hasAttribute('hidden') || current.getAttribute('aria-hidden') === 'true') return true;
    if (current.hasAttribute('data-poop-translator-root')) return true;
    const editable = current.getAttribute('contenteditable');
    if ((current instanceof HTMLElement && current.isContentEditable) || (editable !== null && editable !== 'false')) return true;
    const style = current instanceof HTMLElement ? getComputedStyle(current) : undefined;
    if (style?.display === 'none' || style?.visibility === 'hidden') return true;
  }
  return false;
}

function isSkippedElementMemo(element: Element | null, memo: WeakMap<Element, boolean>): boolean {
  if (!element) return false;
  if (memo.has(element)) return memo.get(element)!;

  const path: Element[] = [];
  let current: Element | null = element;
  let isSkipped = false;

  while (current) {
    if (memo.has(current)) {
      isSkipped = memo.get(current)!;
      break;
    }
    path.push(current);

    if (SKIPPED_TAGS.has(current.tagName)) { isSkipped = true; break; }
    if (current.hasAttribute('hidden') || current.getAttribute('aria-hidden') === 'true') { isSkipped = true; break; }
    if (current.hasAttribute('data-poop-translator-root')) { isSkipped = true; break; }
    const editable = current.getAttribute('contenteditable');
    if ((current instanceof HTMLElement && current.isContentEditable) || (editable !== null && editable !== 'false')) { isSkipped = true; break; }
    const style = current instanceof HTMLElement ? getComputedStyle(current) : undefined;
    if (style?.display === 'none' || style?.visibility === 'hidden') { isSkipped = true; break; }

    current = current.parentElement;
  }

  for (const el of path) {
    memo.set(el, isSkipped);
  }

  return isSkipped;
}

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div id="root">
    ${Array.from({ length: 1000 }).map((_, i) => `
      <div>
        <p>
          <span>Text ${i}</span>
          <span>More text ${i}</span>
        </p>
      </div>
    `).join('')}
  </div>
</body></html>`);

global.document = dom.window.document;
global.NodeFilter = dom.window.NodeFilter;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.getComputedStyle = dom.window.getComputedStyle;

const root = document.getElementById('root')!;

const runBench = (name: string, fn: (el: Element | null, memo: WeakMap<Element, boolean>) => boolean) => {
  const start = performance.now();
  for (let i = 0; i < 10; i++) {
    const memo = new WeakMap<Element, boolean>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node as Text;
        if (!text.data.trim() || fn(text.parentElement, memo)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {}
  }
  const end = performance.now();
  console.log(`${name}: ${end - start}ms`);
}

runBench('Original', isSkippedElementOriginal);
runBench('Memoized', isSkippedElementMemo);
