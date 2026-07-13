export class AccountValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountValidationError';
  }
}

export class AccountUserNameAlreadyExistsError extends Error {
  constructor(readonly userName: string) {
    super('このユーザーIDはすでに使用されています。');
    this.name = 'AccountUserNameAlreadyExistsError';
  }
}

export class AccountNotFoundError extends Error {
  constructor(readonly accountId: string) {
    super('Accountが見つかりません。');
    this.name = 'AccountNotFoundError';
  }
}
