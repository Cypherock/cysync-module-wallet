export enum WalletErrorType {
  INACCESSIBLE_ACCOUNT,
  SUFFICIENT_CONFIRMED_BALANCE = 'DS_OPTS_1011',
  INSUFFICIENT_FUNDS = 'DS_OPTS_1010'
}

const defaultErrorMessages = {
  [WalletErrorType.INSUFFICIENT_FUNDS]: 'Insufficient funds in wallet',
  [WalletErrorType.INACCESSIBLE_ACCOUNT]:
    'Acccount is not accessible with wallet',
  [WalletErrorType.SUFFICIENT_CONFIRMED_BALANCE]: 'Sufficient confirmed balance'
};

export class WalletError extends Error {
  public errorType: WalletErrorType;
  constructor(errorType: WalletErrorType, msg?: string) {
    let message = msg;

    if (!msg && defaultErrorMessages[errorType]) {
      message = defaultErrorMessages[errorType];
    }

    super(message);
    this.errorType = errorType;

    Object.setPrototypeOf(this, WalletError.prototype);
  }
}
