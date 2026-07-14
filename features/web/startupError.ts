export type WebStartupErrorStage = 'web_database_init' | 'web_sqlite_worker' | 'unknown';

export type WebStartupErrorDetails = {
  title: string;
  message: string;
  recoveryAction: string;
  stage: WebStartupErrorStage;
  developerName: string;
  developerMessage: string;
};

const fallbackMessage =
  'ブラウザを再読み込みしてください。問題が続く場合は、開発者コンソールのログを確認してください。';
const accessHandleMessage =
  '同じブラウザでDartsAppを開いている別のタブを閉じ、この画面を再読み込みしてください。';

export function buildWebStartupErrorDetails(
  error: unknown,
  stage: WebStartupErrorStage = 'unknown',
): WebStartupErrorDetails {
  const normalizedError = normalizeError(error);
  const isAccessHandleConflict = hasAccessHandleConflict(error);

  return {
    title: 'DartsAppを起動できませんでした。',
    message: isAccessHandleConflict
      ? 'DartsAppのデータベースを開けませんでした。'
      : 'Webデータベースの初期化に失敗しました。',
    recoveryAction: isAccessHandleConflict ? accessHandleMessage : fallbackMessage,
    stage,
    developerName: normalizedError.name,
    developerMessage: normalizedError.message,
  };
}

function normalizeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
    };
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return {
      name: 'Error',
      message: error,
    };
  }

  return {
    name: 'Error',
    message: 'Unknown error',
  };
}

function hasAccessHandleConflict(error: unknown): boolean {
  return collectErrorText(error).some((text) => {
    const lowerText = text.toLowerCase();
    return (
      lowerText.includes('nomodificationallowederror') ||
      lowerText.includes('createsyncaccesshandle') ||
      lowerText.includes('another open access handle') ||
      lowerText.includes('writablestream associated with the same file')
    );
  });
}

function collectErrorText(error: unknown, seen = new Set<unknown>()): string[] {
  if (error === null || error === undefined || seen.has(error)) {
    return [];
  }
  seen.add(error);

  if (error instanceof Error) {
    const parts = [error.name, error.message];
    const cause = 'cause' in error ? (error as { cause?: unknown }).cause : undefined;
    return [...parts, ...collectErrorText(cause, seen)].filter((part) => part.length > 0);
  }

  if (typeof error === 'string') {
    return [error];
  }

  if (typeof error === 'object') {
    const cause = 'cause' in error ? (error as { cause?: unknown }).cause : undefined;
    return collectErrorText(cause, seen);
  }

  return [String(error)];
}
