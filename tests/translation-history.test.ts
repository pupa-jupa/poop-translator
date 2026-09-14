import { describe, expect, it } from 'vitest';
import { persistTranslationHistory } from '../src/core/translation-history';

describe('persistTranslationHistory', () => {
  it('reports a storage failure without rejecting an already completed translation', async () => {
    const result = await persistTranslationHistory(async () => {
      throw new Error('QUOTA_BYTES exceeded');
    });

    expect(result).toEqual({ status: 'failed', message: 'QUOTA_BYTES exceeded' });
  });

  it('distinguishes a saved entry from a disabled or duplicate one', async () => {
    await expect(persistTranslationHistory(async () => true)).resolves.toEqual({ status: 'saved' });
    await expect(persistTranslationHistory(async () => false)).resolves.toEqual({ status: 'skipped' });
  });
});
