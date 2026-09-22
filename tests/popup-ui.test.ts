import { describe, expect, it } from 'vitest';
import { activateTab, mountPopupShell } from '../src/popup/ui';

describe('popup shell', () => {
  it('renders five Russian navigation tabs with translation active', () => {
    const root = document.createElement('div');
    mountPopupShell(root);

    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Перевод', 'История', 'Словарь', 'Карточки', 'Настройки',
    ]);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector<HTMLElement>('[data-view="translate"]')?.hidden).toBe(false);
    expect(Array.from(root.querySelectorAll<HTMLOptionElement>('[data-control="source-mode"] option')).map((option) => option.value))
      .toEqual(['en', 'ru', 'uk', 'de', 'fr', 'es', 'auto']);
    expect(Array.from(root.querySelectorAll<HTMLOptionElement>('[data-control="target-language"] option')).map((option) => option.value))
      .toEqual(['ru', 'en']);
  });

  it('changes the visible panel and accessible selection together', () => {
    const root = document.createElement('div');
    mountPopupShell(root);

    activateTab(root, 'dictionary');

    expect(root.querySelector('[data-tab="dictionary"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector<HTMLElement>('[data-view="translate"]')?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-view="dictionary"]')?.hidden).toBe(false);
  });

  it('provides a review panel with a named due count and card container', () => {
    const root = document.createElement('div');
    mountPopupShell(root);
    activateTab(root, 'review');
    expect(root.querySelector('[data-tab="review"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector<HTMLElement>('[data-view="review"]')?.hidden).toBe(false);
    expect(root.querySelector('[data-review-due]')?.getAttribute('aria-live')).toBe('polite');
    expect(root.querySelector('[data-review-list]')).not.toBeNull();
  });

  it('provides named controls for translation and destructive actions', () => {
    const root = document.createElement('div');
    mountPopupShell(root);

    expect(root.querySelector('[aria-label="Текст для перевода"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="Сохранять историю"]')).not.toBeNull();
    expect(root.querySelector('[data-action="clear-all"]')?.textContent).toContain('Сбросить все данные');
    expect(root.querySelector('[data-action="translate-region"]')?.textContent).toContain('Выбрать область');
    const translatePanel = root.querySelector('[data-view="translate"]');
    const regionTool = translatePanel?.querySelector('.region-tool');
    expect(regionTool).not.toBeNull();
    expect(regionTool!.compareDocumentPosition(
      translatePanel!.querySelector('.translate-form')!,
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reserves an accessible result area for alternative meanings', () => {
    const root = document.createElement('div');
    mountPopupShell(root);

    const variants = root.querySelector<HTMLElement>('[data-result-variants]');
    expect(variants?.hidden).toBe(true);
    expect(variants?.getAttribute('aria-label')).toBe('Варианты перевода');
    expect(variants?.querySelector('[data-result-variants-list]')).not.toBeNull();
  });

  it('provides readable text scale and local backup controls', () => {
    const root = document.createElement('div');
    mountPopupShell(root);

    const scales = Array.from(root.querySelectorAll<HTMLOptionElement>('[data-control="text-scale"] option'));
    expect(scales.map((option) => [option.value, option.textContent?.trim()])).toEqual([
      ['100', 'Обычный'], ['115', 'Крупный'], ['130', 'Очень крупный'],
    ]);
    expect(root.querySelector('[data-action="export-data"]')?.textContent).toContain('Экспорт');
    expect(root.querySelector('[data-action="import-data"]')?.textContent).toContain('Импорт');
    expect(root.querySelector<HTMLInputElement>('[data-import-file]')?.accept).toBe('application/json,.json');
  });
});
