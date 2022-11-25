import {
  FeatureName,
  NearCoinData,
  isFeatureEnabled
} from '@cypherock/communication';
import IWallet from '../interface/wallet';
import * as nearAPI from 'near-api-js';
import { getAccounts, getBalance, getBlockHash, getKeys } from './client';
import { logger } from '../utils';
import { intToUintByte } from '../bitcoinForks/segwitHelper';
import { WalletError, WalletErrorType } from '../errors';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';
import verifyTxn from './txVerifier';
import generateNearAddress from '../utils/generateNearAddress';
import uint8ArrayFromHexString from '../utils/uint8ArrayFromHexString';
import { base_decode } from 'near-api-js/lib/utils/serialize';

export default class NearWallet implements IWallet {
  xpub: string;
  address: string;
  nearPublicKey: string;
  network: string;
  functionCallGasAmount: string;
  newAccountAmount: string;
  coin: NearCoinData;

  constructor(xpub: string, coin: NearCoinData) {
    this.xpub = xpub;
    this.coin = coin;
    this.network = coin.network;
    this.address = generateNearAddress(this.xpub);
    this.nearPublicKey =
      this.coin.curve +
      ':' +
      nearAPI.utils.serialize.base_encode(
        uint8ArrayFromHexString(this.address)
      );
    this.functionCallGasAmount = '300000000000000';
    this.newAccountAmount = '100000000000000000000000';
  }

  newReceiveAddress(): string {
    return this.address;
  }

  public getDerivationPath(sdkVersion: string): string {
    const purposeIndex = '8000002c';
    const coinIndex = this.coin.coinIndex;
    const accountIndex = '80000000';
    const chainIndex = '80000000';
    const addressIndex = '80000001';

    let contractDummyPadding;
    if (isFeatureEnabled(FeatureName.TokenNameRestructure, sdkVersion))
      contractDummyPadding = '00';
    else contractDummyPadding = '0000000000000000';

    const longChainId = isFeatureEnabled(
      FeatureName.EvmLongChainId,
      sdkVersion
    );

    return (
      purposeIndex +
      coinIndex +
      accountIndex +
      chainIndex +
      addressIndex +
      contractDummyPadding +
      intToUintByte(0, longChainId ? 64 : 8)
    );
  }

  public getDerivationPathForCustomAccount(
    customAccount: string,
    sdkVersion: string
  ): string {
    const purposeIndex = '8000002c';
    const coinIndex = this.coin.coinIndex;
    const accountIndex = '80000000';
    const chainIndex = '80000000';
    const addressIndex = '80000001';

    let contractDummyPadding;
    if (isFeatureEnabled(FeatureName.TokenNameRestructure, sdkVersion))
      contractDummyPadding = '00';
    else contractDummyPadding = '0000000000000000';

    const acc = Buffer.from(customAccount).toString('hex');
    const longChainId = isFeatureEnabled(
      FeatureName.EvmLongChainId,
      sdkVersion
    );
    return (
      purposeIndex +
      coinIndex +
      accountIndex +
      chainIndex +
      addressIndex +
      contractDummyPadding +
      intToUintByte(0, longChainId ? 64 : 8) +
      acc.padEnd(66, '0')
    );
  }

  async getTotalBalanceLinked() {
    const accounts = await getAccounts(this.nearPublicKey, this.coin.network);
    const balances = await Promise.all(
      accounts.map(async (account: any) => {
        const balance = await getBalance(account.account_id, this.coin.network);
        return balance;
      })
    );
    const totalBalance = balances.reduce(
      (acc: number, curr: number) => acc + curr,
      0
    );
    return {
      balance: totalBalance
    };
  }

  async getTotalBalance() {
    const balance = await getBalance(this.nearPublicKey, this.coin.network);
    return { balance };
  }

  async getTotalBalanceCustom(account?: string) {
    const balance = await getBalance(
      account ? account : this.address,
      this.coin.network
    );
    return { balance };
  }

  async setupNewWallet() {
    // do nothing
  }

  async generateMetaData(
    gasFees: number,
    sdkVersion: string,
    addAccount?: boolean
  ) {
    try {
      logger.info('Generating metadata for near', {
        address: this.address
      });
      const purposeIndex = '8000002c';
      const coinIndex = this.coin.coinIndex;
      const accountIndex = '80000000';

      const inputCount = 1;
      const chainIndex = '80000000';
      const addressIndex = '80000001';
      const inputString = chainIndex + addressIndex;

      const outputCount = 1;
      const outputString = '0000000000000000';

      const changeCount = 1;
      const changeString = '0000000000000000';
      const decimal = intToUintByte(this.coin.decimal, 8);

      let transactionFees;
      let contractDummyPadding;
      if (isFeatureEnabled(FeatureName.TokenNameRestructure, sdkVersion)) {
        contractDummyPadding = '00';
        transactionFees = intToUintByte(Math.round(gasFees / 10000), 16 * 4);
      } else {
        transactionFees = intToUintByte(0, 32);
        contractDummyPadding = intToUintByte(
          Math.round(gasFees / 10000),
          16 * 4
        ); //changing decimal to fit the size only until protobuff
      }
      const longChainId = isFeatureEnabled(
        FeatureName.EvmLongChainId,
        sdkVersion
      );
      return (
        purposeIndex +
        coinIndex +
        accountIndex +
        intToUintByte(inputCount, 8) +
        inputString +
        intToUintByte(outputCount, 8) +
        outputString +
        intToUintByte(changeCount, 8) +
        changeString +
        transactionFees +
        decimal +
        contractDummyPadding +
        (addAccount
          ? intToUintByte(1, 64)
          : intToUintByte(0, longChainId ? 64 : 8))
      );
    } catch (e) {
      logger.error('Error generating metadata', e);
      throw e;
    }
  }

  async generateUnsignedTransaction(
    receiverAddress: string,
    amount: BigNumber,
    isSendAll: boolean,
    transactionFee: BigNumber,
    senderAddressArg?: string
  ): Promise<{
    txn: string;
    inputs: Array<{
      value: string;
      address: string;
      isMine: boolean;
    }>;
    outputs: Array<{ value: string; address: string; isMine: boolean }>;
  }> {
    try {
      const senderAddress = senderAddressArg || this.address;
      let totalAmount = amount;
      if (isSendAll) {
        const balance = new BigNumber(
          (await this.getTotalBalanceCustom(senderAddress)).balance
        );
        totalAmount = balance.minus(transactionFee);
        if (totalAmount.isNegative()) {
          throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
        }
      }
      //@ts-ignore required to convert BigNumber to BN.js instance
      const bnAmount = Web3.utils.toBN(totalAmount);
      const action = nearAPI.transactions.transfer(bnAmount);
      const transaction = await this.generateTransactionAsHex(
        receiverAddress,
        [action],
        senderAddress
      );
      return {
        txn: transaction,
        inputs: [
          {
            address: senderAddress,
            value: totalAmount.toString(),
            isMine: true
          }
        ],
        outputs: [
          {
            address: receiverAddress,
            value: totalAmount.toString(),
            isMine: senderAddress === receiverAddress
          }
        ]
      };
    } catch (e) {
      logger.error('Error generating unsigned transaction', e);
      throw e;
    }
  }

  public async generateDeleteAccountTransaction(
    beneficiaryAddress: string,
    senderAddressArg?: string
  ): Promise<{
    txn: string;
    beneficiary: string;
  }> {
    const senderAddress = senderAddressArg || this.address;
    const action = new nearAPI.transactions.Action({
      deleteAccount: new nearAPI.transactions.DeleteAccount({
        beneficiaryAddress
      })
    });
    const transaction = await this.generateTransactionAsHex(
      senderAddress,
      [action],
      senderAddress
    );
    return {
      txn: transaction,
      beneficiary: beneficiaryAddress
    };
  }

  public async generateCreateAccountTransaction(
    newAccountId: string,
    senderAddressArg?: string
  ): Promise<{
    txn: string;
    inputs: Array<{
      value: string;
      address: string;
      isMine: boolean;
    }>;
    outputs: Array<{ value: string; address: string; isMine: boolean }>;
  }> {
    const senderAddress = senderAddressArg || this.address;
    const args = {
      new_account_id: newAccountId,
      new_public_key: this.nearPublicKey
    };
    const action = new nearAPI.transactions.Action({
      functionCall: new nearAPI.transactions.FunctionCall({
        methodName: 'create_account',
        args: this.stringifyJsonOrBytes(args),
        gas: this.functionCallGasAmount,
        deposit: this.newAccountAmount
      })
    });
    const contractId = this.coin.network === 'mainnet' ? 'near' : 'testnet';
    const transaction = await this.generateTransactionAsHex(
      contractId,
      [action],
      senderAddress
    );
    return {
      txn: transaction,
      inputs: [
        {
          address: senderAddress,
          value: this.newAccountAmount.toString(),
          isMine: true
        }
      ],
      outputs: [
        {
          address: newAccountId,
          value: this.newAccountAmount.toString(),
          isMine: false
        }
      ]
    };
  }

  async generateTransactionAsHex(
    recieverAddress: string,
    actions: nearAPI.transactions.Action[],
    senderAddressArg?: string
  ): Promise<string> {
    const senderAddress = senderAddressArg || this.address;
    const blockHash = await getBlockHash(this.coin.network);
    const keys = await getKeys(senderAddress, this.coin.network);
    let key: any;
    for (const k of keys) {
      if (k.public_key === this.nearPublicKey) {
        key = k;
        break;
      }
    }
    if (!key) {
      throw new WalletError(WalletErrorType.INACCESSIBLE_ACCOUNT);
    }
    const nonce = ++key.access_key.nonce;
    const transaction = nearAPI.transactions.createTransaction(
      senderAddress,
      nearAPI.utils.PublicKey.fromString(this.nearPublicKey),
      recieverAddress,
      nonce,
      actions,
      base_decode(blockHash)
    );
    return (transaction.encode() as Buffer).toString('hex');
  }

  stringifyJsonOrBytes(args: any) {
    const isUint8Array =
      args.byteLength !== undefined && args.byteLength === args.length;
    const serializedArgs = isUint8Array
      ? args
      : Buffer.from(JSON.stringify(args));
    return serializedArgs;
  }

  public async verifySignedTxn(signedTxn: string): Promise<boolean> {
    return verifyTxn(signedTxn, this.nearPublicKey);
  }

  public getSignedTransaction(
    unsignedTransaction: string,
    inputSignature: string
  ): string {
    const transaction = nearAPI.transactions.Transaction.decode(
      Buffer.from(unsignedTransaction, 'hex')
    );
    const stxn = new nearAPI.transactions.SignedTransaction({
      transaction,
      signature: new nearAPI.transactions.Signature({
        keyType: transaction.publicKey.keyType,
        data: uint8ArrayFromHexString(inputSignature)
      })
    });
    return (stxn.encode() as Buffer).toString('hex');
  }

  public async approximateTxnFee(
    amount: BigNumber | undefined,
    feeRate: number,
    isSendAll?: boolean,
    customAccount?: string
  ): Promise<{ fees: BigNumber; amount: BigNumber }> {
    logger.verbose('Approximating Txn Fee', { address: this.address });

    logger.info('Approximating Txn Fee data', {
      amount,
      feeRate,
      isSendAll
    });

    let totalAmount = new BigNumber(0);
    if (amount) {
      totalAmount = amount;
    }

    const balance = new BigNumber(
      (await this.getTotalBalanceCustom(customAccount)).balance
    );

    logger.info('Near balance', { balance });

    const totalFee = new BigNumber(feeRate);
    logger.info('Total fee', { totalFee });

    if (isSendAll) {
      totalAmount = balance.minus(totalFee);
      if (totalAmount.isNegative()) {
        throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
      }
    }

    if (balance.isLessThan(totalAmount.plus(totalFee))) {
      throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
    }
    logger.debug('Approximating Txn Fee completed', {
      fee: totalFee,
      amount: totalAmount
    });
    return { fees: totalFee, amount: totalAmount };
  }
}
