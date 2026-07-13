import type { AccountRegistrationInput } from './types';
import { AccountValidationError } from './errors';

export function normalizeUserName(userName: string) {
  return userName.trim();
}

export function normalizeEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export function validateAccountRegistration(input: AccountRegistrationInput) {
  const userName = normalizeUserName(input.userName);
  const displayName = input.displayName.trim();
  const emailNormalized = normalizeEmail(input.email);

  if (!/^[a-z0-9_]{3,20}$/.test(userName)) {
    throw new AccountValidationError(
      'ユーザーIDは3〜20文字の英小文字・数字・_で入力してください。',
    );
  }

  if (displayName.length < 1 || displayName.length > 30) {
    throw new AccountValidationError('表示名は1〜30文字で入力してください。');
  }

  return {
    userName,
    displayName,
    emailNormalized,
  };
}

export function validateAccountProfileUpdate(input: {
  displayName: string;
  email?: string | null;
}) {
  const displayName = input.displayName.trim();
  const emailNormalized = normalizeEmail(input.email);

  if (displayName.length < 1 || displayName.length > 30) {
    throw new AccountValidationError('表示名は1〜30文字で入力してください。');
  }

  return {
    displayName,
    emailNormalized,
  };
}
