import { describe, expect, it } from 'vitest';
import { activateTab, mountPopupShell } from '../src/popup/ui';

describe('popup shell', () => {
  it('renders four Russian navigation tabs with translation active', () => {
    const root = document.createElement('div');
    mountPopupShell(root);

    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Перевод', 'История', 'Словарь', 'Настройки',
    ]);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector<HTMLElement>('[data-view="translate"]')?.hidden).toBe(false);
    expect(Array.from(root.querySelectorAll<HTMLOptionElement>('[data-control="source-mode"] option')).map((option) => option.value))
      .toEqual(['en', 'ru', 'auto']);
  });

  it('changes the visible panel and accessible selection together', () => {
    const root = document.createElement('div');
    mountPopupShell(root);

    activateTab(root, 'dictionary');

    expect(root.querySelector('[data-tab="dictionary"]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector<HTMLElement>('[data-view="translate"]')?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-view="dictionary"]')?.hidden).toBe(false);
  });

  it('provides named controls for translation and destructive actions', () => {
    const root = document.createElement('div');
    mountPopupShell(root);

    expect(root.querySelector('[aria-label="Текст для перевода"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="Сохранять историю"]')).not.toBeNull();
    expect(root.querySelector('[data-action="clear-all"]')?.textContent).toContain('Сбросить все данные');
  });

  it('reserves an accessible result area for alternative meanings', () => {
    const root = document.createElement('div');
    mountPopupShell(root);

    const variants = root.querySelector<HTMLElement>('[data-result-variants]');
    expect(variants?.hidden).toBe(true);
    expect(variants?.getAttribute('aria-label')).toBe('Варианты перевода');
    expect(variants?.querySelector('[data-result-variants-list]')).not.toBeNull();
  });
});
