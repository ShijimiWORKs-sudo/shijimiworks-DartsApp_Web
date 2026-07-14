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

export function buildWebStartupErrorDetails(
  error: unknown,
  stage: WebStartupErrorStage = 'unknown',
): WebStartupErrorDetails {
  const normalizedError = normalizeError(error);

  return {
    title: 'DartsAppを起動できませんでした。',
    message: 'Webデータベースの初期化に失敗しました。',
    recoveryAction: fallbackMessage,
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
