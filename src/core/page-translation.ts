const SKIPPED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'FORM', 'LABEL', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'BUTTON', 'SVG', 'CANVAS',
]);

// ⚡ Bolt Optimization:
// We no longer check the entire parent chain for every text node bottom-up.
// Instead, collectTextNodes uses a top-down TreeWalker that rejects skipped branches.
// This function now only checks the specific element passed to it.
function isSkippedElement(current: Element): boolean {
  if (SKIPPED_TAGS.has(current.tagName)) return true;
  if (current.hasAttribute('hidden') || current.getAttribute('aria-hidden') === 'true') return true;
  if (current.hasAttribute('data-poop-translator-root')) return true;
  const editable = current.getAttribute('contenteditable');
  if ((current instanceof HTMLElement && current.isContentEditable) || (editable !== null && editable !== 'false')) return true;
  const style = current instanceof HTMLElement ? getComputedStyle(current) : undefined;
  if (style?.display === 'none' || style?.visibility === 'hidden') return true;
  return false;
}

export function findMainContent(documentRoot: Document = document): HTMLElement {
  return documentRoot.querySelector<HTMLElement>('main, article, [role="main"]') ?? documentRoot.body;
}

export function collectTextNodes(root: Node): Text[] {
  // ⚡ Bolt Optimization:
  // Top-down DOM traversal (O(N) instead of O(N*D)).
  // If the root node itself is an element that should be skipped, return early.
  if (root.nodeType === Node.ELEMENT_NODE && isSkippedElement(root as Element)) {
    return [];
  }

  const doc = root.ownerDocument ?? document;
  // By using NodeFilter.SHOW_ELEMENT, we can return FILTER_REJECT for skipped elements,
  // which efficiently prunes the entire sub-tree and prevents redundant getComputedStyle calls
  // on every child text node's parent chain.
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return isSkippedElement(node as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
      const text = node as Text;
      if (!text.data.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const result: Text[] = [];
  let node: Node | null;
  // The TreeWalker acceptNode is NOT called on the root node of the walker, so we must check root above.
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) result.push(node as Text);
  }
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
        for (const chunk of splitText(original, this.chunkLimit)) {
          if (signal?.aborted) throw new DOMException('Операция отменена', 'AbortError');
          const translatedPart = (await translateText(chunk)).trim();
          if (signal?.aborted) throw new DOMException('Операция отменена', 'AbortError');
          translatedParts.push(translatedPart);
        }
        const translated = `${leading}${translatedParts.join(' ')}${trailing}`;
        if (node.isConnected && node.data === original) {
          node.data = translated;
          this.snapshots.set(node, { original, translated });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
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
