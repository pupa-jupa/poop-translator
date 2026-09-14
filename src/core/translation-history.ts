export type HistoryPersistenceResult =
  | { status: 'saved' }
  | { status: 'skipped' }
  | { status: 'failed'; message: string };

export async function persistTranslationHistory(
  save: () => Promise<boolean>,
): Promise<HistoryPersistenceResult> {
  try {
    return await save() ? { status: 'saved' } : { status: 'skipped' };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Не удалось сохранить историю',
    };
  }
}
