export enum WalletErrorType {
  INACCESSIBLE_ACCOUNT = 'DS_OPTS_1012',
  BLOCKED_UTXOS_WITH_SUFFICIENT_BALANCE = 'DS_OPTS_1011',
  INSUFFICIENT_FUNDS = 'DS_OPTS_1010'
}

const defaultErrorMessages = {
  [WalletErrorType.INSUFFICIENT_FUNDS]: 'Insufficient funds in wallet',
  [WalletErrorType.INACCESSIBLE_ACCOUNT]:
    'Acccount is not accessible with wallet',
  [WalletErrorType.BLOCKED_UTXOS_WITH_SUFFICIENT_BALANCE]:
    'Blocked UTXOs present with sufficient balance'
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
