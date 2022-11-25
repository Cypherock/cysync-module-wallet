import {
  FeatureName,
  isFeatureEnabled,
  SolanaCoinData
} from '@cypherock/communication';
import IWallet from '../interface/wallet';
import { getBalance, getBlockHash } from './client';
import { logger } from '../utils';
import { intToUintByte } from '../bitcoinForks/segwitHelper';
import { WalletError, WalletErrorType } from '../errors';
import BigNumber from 'bignumber.js';
import generateSolanaAddress from '../utils/generateSolanaAddress';
import { base_decode, base_encode } from 'near-api-js/lib/utils/serialize';
import {
  Transaction,
  SystemProgram,
  PublicKey,
  Message
} from '@solana/web3.js';

export default class SolanaWallet implements IWallet {
  xpub: string;
  address: string;
  solanaPublicKey: string;
  network: string;
  coin: SolanaCoinData;

  constructor(xpub: string, coin: SolanaCoinData) {
    this.xpub = xpub;
    this.coin = coin;
    this.network = coin.network;
    this.address = generateSolanaAddress(this.xpub);
    this.solanaPublicKey = base_decode(this.address).toString('hex');
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

    const contractDummyPadding = '00';
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

  async getTotalBalance() {
    const balance = await getBalance(this.address, this.coin.network);
    return { balance };
  }

  async setupNewWallet() {
    // do nothing
  }

  async generateMetaData(sdkVersion: string, gasFees: number) {
    try {
      logger.info('Generating metadata for solana', {
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

      const contractDummyPadding = '00';
      const transactionFees = intToUintByte(Math.round(gasFees), 16 * 4);
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
        intToUintByte(0, longChainId ? 64 : 8)
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
    transactionFee: BigNumber
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
      const senderAddress = this.address;
      let totalAmount = amount;
      if (isSendAll) {
        const balance = new BigNumber((await this.getTotalBalance()).balance);
        totalAmount = balance.minus(transactionFee);
        if (totalAmount.isNegative()) {
          throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
        }
      }
      const feePayer = PublicKey.decode(
        Buffer.from(base_decode(senderAddress).toString('hex'), 'hex').reverse()
      );
      const receiverPublicKey = PublicKey.decode(
        Buffer.from(
          base_decode(receiverAddress).toString('hex'),
          'hex'
        ).reverse()
      );
      const recentBlockhash = await getBlockHash(this.coin.network);
      const transaction = new Transaction({
        recentBlockhash,
        feePayer
      });
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: feePayer,
          toPubkey: receiverPublicKey,
          lamports: parseInt(totalAmount.toString(), 10)
        })
      );
      const unsignedTransactionHex = transaction
        .serializeMessage()
        .toString('hex');
      return {
        txn: unsignedTransactionHex,
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

  public async verifySignedTxn(signedTxn: string): Promise<boolean> {
    const signedTransaction = Transaction.from(base_decode(signedTxn));
    return signedTransaction.verifySignatures();
  }

  public getSignedTransaction(
    unsignedTransaction: string,
    inputSignature: string
  ): string {
    const transaction = Transaction.populate(
      Message.from(Buffer.from(unsignedTransaction, 'hex'))
    );
    const signerPublicKey = PublicKey.decode(
      Buffer.from(base_decode(this.address).toString('hex'), 'hex').reverse()
    );
    transaction.addSignature(
      signerPublicKey,
      Buffer.from(inputSignature, 'hex')
    );
    return base_encode(transaction.serialize());
  }

  public async approximateTxnFee(
    amount: BigNumber | undefined,
    fee: number,
    isSendAll?: boolean
  ): Promise<{ fees: BigNumber; amount: BigNumber }> {
    logger.verbose('Approximating Txn Fee', { address: this.address });

    logger.info('Approximating Txn Fee data', {
      amount,
      feeRate: fee,
      isSendAll
    });

    let totalAmount = new BigNumber(0);
    if (amount) {
      totalAmount = amount;
    }

    const balance = new BigNumber((await this.getTotalBalance()).balance);

    logger.info('Solana balance', { balance });

    const totalFee = new BigNumber(fee);
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
