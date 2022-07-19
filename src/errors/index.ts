export enum WalletErrorType {
  BLOCKED_UTXOS_WITH_SUFFICIENT_BALANCE = 'DS_OPTS_1011',
  INSUFFICIENT_FUNDS = 'DS_OPTS_1010'
}

const defaultErrorMessages = {
  [WalletErrorType.BLOCKED_UTXOS_WITH_SUFFICIENT_BALANCE]:
    'Sufficient confirmed balance',
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
