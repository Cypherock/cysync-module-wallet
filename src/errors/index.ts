export enum WalletErrorType {
  INSUFFICIENT_FUNDS,
  INACCESSIBLE_ACCOUNT,
}

const defaultErrorMessages = {
  [WalletErrorType.INSUFFICIENT_FUNDS]: 'Insufficient funds in wallet',
  [WalletErrorType.INACCESSIBLE_ACCOUNT]: 'Acccount is not accessible with wallet',
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
