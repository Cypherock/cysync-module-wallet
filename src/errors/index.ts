export enum WalletErrorType {
  INSUFFICIENT_FUNDS
}

const defaultErrorMessages = {
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
