import { MixedDocumentLanguageError } from './document-language';

const SKIPPED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'FORM', 'LABEL', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'BUTTON', 'SVG', 'CANVAS',
]);

function isSkippedElement(element: Element | null, cache?: Map<Element, boolean>): boolean {
  if (!element) return false;
  if (cache?.has(element)) return cache.get(element)!;

  let isSkipped = false;
  const tagName = element.tagName;

  if (SKIPPED_TAGS.has(tagName)) isSkipped = true;
  else if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') isSkipped = true;
  else if (element.hasAttribute('data-poop-translator-root')) isSkipped = true;
  else {
    const editable = element.getAttribute('contenteditable');
    if ((element instanceof HTMLElement && element.isContentEditable) || (editable !== null && editable !== 'false')) isSkipped = true;
    else {
      const style = element instanceof HTMLElement ? getComputedStyle(element) : undefined;
      if (style?.display === 'none' || style?.visibility === 'hidden') isSkipped = true;
    }
  }

  // ⚡ Bolt: Cache expensive DOM and style checks (O(T*D) -> O(E))
  // Reduces getComputedStyle calls from O(TextNodes * AvgDepth) to O(UniqueElements)
  if (!isSkipped && element.parentElement) {
    isSkipped = isSkippedElement(element.parentElement, cache);
  }

  cache?.set(element, isSkipped);
  return isSkipped;
}

export function findMainContent(documentRoot: Document = document): HTMLElement {
  return documentRoot.querySelector<HTMLElement>('main, article, [role="main"]') ?? documentRoot.body;
}

export function collectTextNodes(root: Node): Text[] {
  const doc = root.ownerDocument ?? document;
  // ⚡ Bolt: Provide a cache across the tree walk to prevent redundant ancestor checks
  const skipCache = new Map<Element, boolean>();
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node as Text;
      if (!text.data.trim() || isSkippedElement(text.parentElement, skipCache)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const result: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) result.push(node as Text);
  return result;
}

function splitWords(text: string, maxLength: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > maxLength) {
      if (current) chunks.push(current);
      for (let index = 0; index < word.length; index += maxLength) {
        chunks.push(word.slice(index, index + maxLength));
      }
      current = '';
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function splitText(text: string, maxLength = 1800): string[] {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+(?:[”"']+)?|[^.!?]+$/g)?.map((part) => part.trim()) ?? [clean];
  const chunks: string[] = [];
  let current = '';

  const append = (part: string) => {
    const candidate = current ? `${current} ${part}` : part;
    if (candidate.length <= maxLength) {
      current = candidate;
      return;
    }
    if (current) chunks.push(current);
    current = part;
  };

  for (const sentence of sentences) {
    if (sentence.length <= maxLength) {
      append(sentence);
      continue;
    }
    if (current) {
      chunks.push(current);
      current = '';
    }
    const parts = splitWords(sentence, maxLength);
    for (const part of parts.slice(0, -1)) chunks.push(part);
    current = parts.at(-1) ?? '';
  }
  if (current) chunks.push(current);
  return chunks;
}

interface NodeSnapshot {
  original: string;
  translated: string;
}

export interface PageTranslationSummary {
  completed: number;
  total: number;
  failed: number;
}

export class PageTranslationSession {
  private readonly snapshots = new Map<Text, NodeSnapshot>();

  constructor(private readonly chunkLimit = 1800) {}

  get translatedNodeCount(): number {
    return this.snapshots.size;
  }

  async translate(
    root: Node,
    translateText: (text: string) => Promise<string>,
    onProgress?: (completed: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<PageTranslationSummary> {
    const nodes = collectTextNodes(root);
    let completed = 0;
    let failed = 0;

    for (const node of nodes) {
      if (signal?.aborted) throw new DOMException('Операция отменена', 'AbortError');
      const original = node.data;
      const leading = original.match(/^\s*/)?.[0] ?? '';
      const trailing = original.match(/\s*$/)?.[0] ?? '';
      try {
        const translatedParts: string[] = [];
        const chunks = splitText(original, this.chunkLimit);
        let changed = false;
        for (const chunk of chunks) {
          if (signal?.aborted) throw new DOMException('Операция отменена', 'AbortError');
          const translatedPart = (await translateText(chunk)).trim();
          if (signal?.aborted) throw new DOMException('Операция отменена', 'AbortError');
          if (translatedPart !== chunk) changed = true;
          translatedParts.push(translatedPart);
        }
        const translated = changed ? `${leading}${translatedParts.join(' ')}${trailing}` : original;
        if (changed && node.isConnected && node.data === original) {
          node.data = translated;
          this.snapshots.set(node, { original, translated });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        if (error instanceof MixedDocumentLanguageError) throw error;
        failed += 1;
      }
      completed += 1;
      onProgress?.(completed, nodes.length);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    return { completed, total: nodes.length, failed };
  }

  restore(): number {
    let restored = 0;
    for (const [node, snapshot] of this.snapshots) {
      if (node.isConnected && node.data === snapshot.translated) {
        node.data = snapshot.original;
        restored += 1;
      }
    }
    this.snapshots.clear();
    return restored;
  }
}
