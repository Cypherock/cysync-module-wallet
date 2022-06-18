import { NearCoinData } from '@cypherock/communication';
import IWallet from '../interface/wallet';
import * as nearAPI from 'near-api-js';
import { getAccounts, getBalance,getBlockHash, getKeys } from './client';
import { logger } from '../utils';
import { intToUintByte } from '../bitcoinForks/segwitHelper';
import { WalletError, WalletErrorType } from '../errors';
import BN from 'bn.js';
import BigNumber from 'bignumber.js';
import verifyTxn from './txVerifier';
import generateNearAddress from '../utils/generateNearAddress';
import uint8ArrayFromHexString from '../utils/uint8ArrayFromHexString';
import { base_decode } from 'near-api-js/lib/utils/serialize';

export default class NearWallet implements IWallet {
  xpub: string;
  address: string;
  nearPublicKey: string;
  node: number;
  network: string;
  functionCallGasAmount:number;
  newAccountAmount:number;
  coin: NearCoinData;

  constructor(xpub: string, coin: NearCoinData, node = 0) {
    this.node = node;
    this.xpub = xpub;
    this.coin = coin;
    this.network = coin.network;
    this.address = generateNearAddress(this.xpub);
    this.nearPublicKey = this.coin.curve + ':' + nearAPI.utils.serialize.base_encode(uint8ArrayFromHexString(this.address));
    this.functionCallGasAmount = 1;
    this.newAccountAmount = 1;
  }

  newReceiveAddress():string{
    return this.address;
  }

  public getDerivationPath(): string {
    const purposeIndex = '8000002c';
    const coinIndex = this.coin.coinIndex;
    const accountIndex = '80000000';
    const chainIndex = '80000000';
    const addressIndex = '80000001';//need to use this.node instead of hardcoded 80000001
    const contractDummyPadding = '0000000000000000';
    return (
      purposeIndex +
      coinIndex +
      accountIndex +
      chainIndex +
      addressIndex +
      contractDummyPadding +
      '00'
    );
  }

  async getTotalBalance() {
    const accounts = await getAccounts(this.nearPublicKey, this.coin.network);
    const balances = await Promise.all(accounts.map(async (account:any) => {
      const balance = await getBalance(account.account_id, this.coin.network);
      return balance;
    }));
    const totalBalance = balances.reduce((acc:number, curr:number) => acc+curr,0);
    return {
      balance: totalBalance
    }
  }

  async setupNewWallet() {
    // do nothing
  }

  async generateMetaData(gasFees: number) {
    try{
      logger.info('Generating metadata for near', {
        address: this.address,
      });
      const purposeIndex = '8000002c';
      const coinIndex = this.coin.coinIndex;
      const accountIndex = '80000000';

      const inputCount = 1;
      const chainIndex = '80000000';
      const addressIndex = '80000001'; //could be changed to use this.node
      const inputString = chainIndex + addressIndex;

      const outputCount = 1;
      const outputString = '0000000000000000';

      const changeCount = 1;
      const changeString = '0000000000000000';

      const gas = intToUintByte(gasFees, 32);

      const decimalDummyPadding = intToUintByte(0, 8);
      const contractDummyPadding = '0000000000000000';
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
        gas +
        decimalDummyPadding +
        contractDummyPadding +
        intToUintByte(0, 8)
      );
    } catch (e) {
      logger.error('Error generating metadata', e);
      throw e;
    }
  }

  async generateUnsignedTransaction(
    recieverAddress: string,
    amount: BigNumber,
    senderAddress?: string
  ): Promise<{
    txn: string;
    inputs: Array<{
      value: string;
      address: string;
      isMine: boolean;
    }>;
    outputs: Array<{ value: string; address: string; isMine: boolean }>;
  }> {
    try{
      senderAddress = senderAddress || this.address;
      const bn_amount = new BN(amount.toString());
      const action = nearAPI.transactions.transfer(bn_amount);
      const transaction = await this.generateTransactionAsHex(recieverAddress, [action], senderAddress);
      return {
        txn: transaction,
        inputs: [
          { address: senderAddress, value: amount.toString(), isMine: true }
        ],
        outputs: [
          {
            address: recieverAddress,
            value: amount.toString(),
            isMine: false,
          }
        ]
      };
    } catch(e){
      logger.error('Error generating unsigned transaction', e);
      throw e;
    }
  }

  public async generateDeleteAccountTransaction(
    benificiaryAddress:string,
    senderAddress?:string
  ):Promise<{
    txn:string;
    benificiary:string;
  }> {
    senderAddress = senderAddress || this.address;
    const action = new nearAPI.transactions.Action({ deleteAccount: new nearAPI.transactions.DeleteAccount({ benificiaryAddress }) });
    const transaction = await this.generateTransactionAsHex(senderAddress, [action], senderAddress);
    return {
      txn: transaction,
      benificiary:benificiaryAddress
    };
  }

  public async generateCreateAccountTransaction(
    newAccountId:string
  ):Promise<{
    txn:string;
    newAccountId:string
  }>{
    const args = {
      nea_account_id:newAccountId,
      new_public_key:this.nearPublicKey
    }
    const action = new nearAPI.transactions.Action({ functionCall: new nearAPI.transactions.FunctionCall({ methodName:'create_account',
      args: this.stringifyJsonOrBytes(args),
      gas:this.functionCallGasAmount, attached_deposit:this.newAccountAmount }) });
    const contractId = this.coin.network==='mainnet'?'near':'testnet';
    const transaction = await this.generateTransactionAsHex(contractId, [action]);
    return {
      txn: transaction,
      newAccountId: newAccountId,
    };
  }

  async generateTransactionAsHex(
    recieverAddress: string,
    actions: nearAPI.transactions.Action[],
    senderAddress?: string
  ): Promise<string> {
    senderAddress = senderAddress || this.address;
    const blockHash = await getBlockHash(this.coin.network);
    const keys = await getKeys(senderAddress);
    console.log(keys,this.nearPublicKey);
    let key:any;
    for (const k of keys) {
      if (k.public_key === this.nearPublicKey) {
        key = k;
        break;
      }
    }
    if(!key) {
      throw new WalletError(WalletErrorType.INACCESSIBLE_ACCOUNT);
    }
    const nonce = ++key.access_key.nonce;
    const transaction = nearAPI.transactions.createTransaction(senderAddress,
      nearAPI.utils.PublicKey.fromString(this.nearPublicKey),
      recieverAddress,nonce,
      actions,base_decode(blockHash));
    return (transaction.encode() as Buffer).toString('hex');
  }

  stringifyJsonOrBytes(args:any) {
    const isUint8Array = args.byteLength !== undefined && args.byteLength === args.length;
    const serializedArgs = isUint8Array ? args : Buffer.from(JSON.stringify(args));
    return serializedArgs;
  }

  public async verifySignedTxn(signedTxn:string):Promise<boolean>{
    return verifyTxn(signedTxn);
  }

  public getSignedTransaction(
    unsignedTransaction: string,
    inputSignature: string
  ): string {
    const transaction = nearAPI.transactions.Transaction.decode(Buffer.from(unsignedTransaction, 'hex'));
    const stxn = new nearAPI.transactions.SignedTransaction({transaction: transaction,
                  signature: new nearAPI.transactions.Signature({
                    keyType: transaction.publicKey.keyType,
                    data: uint8ArrayFromHexString(inputSignature)
                  })});
    return (stxn.encode() as Buffer).toString('hex');
  }

  public async approximateTxnFee(
    amount: BigNumber | undefined,
    feeRate:number,
    isSendAll?: boolean,
  ): Promise<{ fees: BigNumber; amount: BigNumber }> {
    logger.verbose('Approximating Txn Fee', { address: this.address });

    logger.info('Approximating Txn Fee data', {
      amount,
      feeRate,
      isSendAll,
    });

    let totalAmount = new BigNumber(0);
    if (amount) {
      totalAmount = amount;
    }

    const balance = new BigNumber((await this.getTotalBalance()).balance);

    logger.info('Near balance', { balance });

    // From Gwei to wei
    const totalFee = new BigNumber(0);
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
    logger.debug('Approximating Txn Fee completed', { fee: totalFee , amount: totalAmount });
    return { fees: totalFee, amount: totalAmount };
  }
}