export enum WalletErrorType {
  SUFFICIENT_CONFIRMED_BALANCE,
  INSUFFICIENT_FUNDS
}

const defaultErrorMessages = {
  [WalletErrorType.SUFFICIENT_CONFIRMED_BALANCE]: 'Sufficient confirmed balance',
  [WalletErrorType.INSUFFICIENT_FUNDS]: 'Insufficient funds in wallet'
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
