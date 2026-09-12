import type { SourceMode, TranslationSource } from './types';

export type PageOperationState = 'idle' | 'awaiting-activation' | 'translating' | 'translated' | 'error';

export interface PageStatus {
  state: PageOperationState;
  completed: number;
  total: number;
  error?: string;
}

export type ContentRequest =
  | { type: 'SHOW_SELECTION_TRANSLATOR'; requestId: string; text: string; source: Extract<TranslationSource, 'context-menu'> }
  | { type: 'TRANSLATE_PAGE'; requestId: string; sourceMode: SourceMode }
  | { type: 'RESTORE_PAGE'; requestId: string }
  | { type: 'GET_PAGE_STATUS'; requestId: string };

export interface RuntimeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasRequestId(value: Record<string, unknown>): boolean {
  return typeof value.requestId === 'string' && value.requestId.startsWith('pt-');
}

export function isContentRequest(value: unknown): value is ContentRequest {
  if (!isRecord(value) || !hasRequestId(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'SHOW_SELECTION_TRANSLATOR':
      return typeof value.text === 'string' && value.text.trim().length > 0 && value.source === 'context-menu';
    case 'TRANSLATE_PAGE':
      return value.sourceMode === 'en' || value.sourceMode === 'auto';
    case 'RESTORE_PAGE':
    case 'GET_PAGE_STATUS':
      return true;
    default:
      return false;
  }
}

export function createRequestId(): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `pt-${id.toLowerCase()}`;
}
