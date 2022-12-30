import { AxiosResponse } from 'axios';
import {
  BTCCOINS,
  BtcCoinMap,
  FeatureName,
  isFeatureEnabled,
  BitcoinAccountTypes
} from '@cypherock/communication';
import {
  bitcoin as bitcoinServer,
  v2 as v2Server
} from '@cypherock/server-wrapper';
import * as bip32 from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import { AddressDB, TransactionDB } from '@cypherock/database';

import IWallet from '../interface/wallet';
import Output from '../interface/output';
import { logger } from '../utils';
import networks from './networks';
import mcache from '../utils/cache';
import verifyTxn from './txVerifier';
import {
  convertZpub,
  getSegwitAddress,
  intToUintByte,
  createSegwitTransaction,
  createSegwitSignedTransaction
} from './segwitHelper';
import { WalletError, WalletErrorType } from '../errors';

/* tslint:disable-next-line */
const coinselect = require('coinselect');
/* tslint:disable-next-line */
const coinselectSplit = require('coinselect/split');

export interface AddressData {
  addressIndex: number;
  address: string;
}

export interface AddressDataList {
  rChain: AddressData[];
  cChain: AddressData[];
}

export default class BitcoinWallet implements Partial<IWallet> {
  xpub: string;
  modifiedZpub?: string;
  coinId: string;
  network: any;
  addressDB: AddressDB | undefined;
  transactionDB: TransactionDB | undefined;
  walletId: string;
  accountType?: string;
  accountIndex: number;
  accountId: string;

  constructor(options: {
    xpub: string;
    coinId: string;
    walletId: string;
    accountType?: string;
    accountId: string;
    accountIndex: number;
    addressDb?: AddressDB;
    transactionDb?: TransactionDB;
  }) {
    const {
      xpub,
      walletId,
      coinId: coinId,
      accountType,
      addressDb,
      transactionDb,
      accountIndex,
      accountId
    } = options;
    this.xpub = xpub;
    this.walletId = walletId;
    this.accountIndex = accountIndex;
    this.accountId = accountId;
    if (
      accountType === BitcoinAccountTypes.nativeSegwit &&
      BTCCOINS[coinId].supportedAccountTypes
        .map(e => e.id)
        .includes(BitcoinAccountTypes.nativeSegwit)
    ) {
      this.modifiedZpub = convertZpub(
        xpub,
        coinId === BtcCoinMap.bitcoinTestnet
      );
      this.xpub = xpub;
    }
    this.coinId = coinId;
    this.addressDB = addressDb;
    this.transactionDB = transactionDb;

    logger.info('Wallet data', {
      coin: this.coinId
    });

    switch (coinId) {
      case BtcCoinMap.bitcoin:
        this.network = bitcoin.networks.bitcoin;
        break;

      case BtcCoinMap.bitcoinTestnet:
        this.network = bitcoin.networks.testnet;
        break;

      case BtcCoinMap.litecoin:
        this.network = networks.litecoin;
        break;

      case BtcCoinMap.dash:
        this.network = networks.dash;
        break;

      case BtcCoinMap.dogecoin:
        this.network = networks.dogecoin;
        break;

      default:
        throw new Error('Please Provide a Valid Coin Type');
    }
  }

  private static hardenPath(hex: string) {
    let s = '';
    for (let i = 0; i < hex.length / 2; i++) {
      s = hex.slice(i * 2, i * 2 + 2) + s;
    }

    return s;
  }

  public static getDerivationPath(accountIndex: number, _accountType: string) {
    return (
      intToUintByte(3, 8) +
      BitcoinWallet.hardenPath(intToUintByte(44, 8 * 4)) +
      BitcoinWallet.hardenPath(intToUintByte(0, 8 * 4)) +
      BitcoinWallet.hardenPath(intToUintByte(accountIndex, 8 * 4))
    );
  }

  public async newReceiveAddress(): Promise<string> {
    return await this.newAddress(0);
  }

  public async newChangeAddress(): Promise<string> {
    return await this.newAddress(1);
  }

  public async getChainAddressIndex(
    address: string
  ): Promise<{ chainIndex: number; addressIndex: number; isSegwit: boolean }> {
    if (this.addressDB) {
      const cacheResult = await this.addressDB.getChainIndex({
        address,
        accountId: this.accountId
      });
      if (cacheResult) {
        return cacheResult;
      }
    }

    const res = this.computeChainAddressIndex(address);

    if (this.addressDB) {
      this.addressDB.insert({
        address,
        walletId: this.walletId,
        coinId: this.coinId,
        chainIndex: res.chainIndex,
        addressIndex: res.addressIndex,
        isSegwit: res.isSegwit,
        accountId: this.accountId
      });
    }

    return res;
  }

  public computeChainAddressIndex(address: string): {
    chainIndex: number;
    addressIndex: number;
    isSegwit: boolean;
  } {
    let chainIndex = -1;
    let addressIndex = -1;
    const isSegwit =
      this.modifiedZpub !== undefined &&
      (address.startsWith('bc') || address.startsWith('tb'));

    if (isSegwit) {
      for (let i = 0; i < 1000; i++) {
        if (
          address ===
          getSegwitAddress(
            this.modifiedZpub || '',
            this.coinId === BtcCoinMap.bitcoin,
            this.network,
            0,
            i
          )
        ) {
          chainIndex = 0;
          addressIndex = i;
          break;
        }

        if (
          address ===
          getSegwitAddress(
            this.modifiedZpub || '',
            this.coinId === BtcCoinMap.bitcoinTestnet,
            this.network,
            1,
            i
          )
        ) {
          chainIndex = 1;
          addressIndex = i;
          break;
        }
      }
    } else {
      for (let i = 0; i < 1000; i++) {
        if (
          address ===
          bitcoin.payments.p2pkh({
            pubkey: bip32
              .fromBase58(this.xpub, this.network)
              .derive(0)
              .derive(i).publicKey,
            network: this.network
          }).address
        ) {
          chainIndex = 0;
          addressIndex = i;
          break;
        }

        if (
          address ===
          bitcoin.payments.p2pkh({
            pubkey: bip32
              .fromBase58(this.xpub, this.network)
              .derive(1)
              .derive(i).publicKey,
            network: this.network
          }).address
        ) {
          chainIndex = 1;
          addressIndex = i;
          break;
        }
      }
    }

    if (chainIndex >= 0 && addressIndex >= 0) {
      return { chainIndex, addressIndex, isSegwit };
    }
    throw new Error('not a valid address');
  }

  async getDerivationPath(sdkVersion: string, address: string): Promise<any> {
    const coinIndex = BTCCOINS[this.coinId].coinIndex;
    const accountIndex = '80000000';

    const addressInfo = await this.getChainAddressIndex(address);

    const purposeIndex = addressInfo.isSegwit ? '80000054' : '8000002c';
    const chainIndex = intToUintByte(addressInfo.chainIndex, 32);
    const addressIndex = intToUintByte(addressInfo.addressIndex, 32);
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

  public async calcTransactionData(
    outputList: Output[],
    feeRate: any,
    isSendAll?: boolean
  ): Promise<{ inputs: any; outputs: any; fee: any }> {
    // This is because we need block state of UTXOs
    if (!this.transactionDB) {
      throw new Error('Transaction DB is required for this action');
    }
    let utxosWithBlocked: any[] = await this.fetchAllUtxos();
    // utxos excluding blocked utxos
    const utxosFiltered = utxosWithBlocked
      .filter(utxo => !utxo.blocked)
      .map(({ blocked, ...rest }) => rest);
    utxosWithBlocked = utxosWithBlocked.map(({ blocked, ...rest }) => rest);

    const newOutputList: Array<{ address: string; value?: number }> = [];

    logger.info('Generating tx data for', {
      outputList,
      feeRate,
      isSendAll,
      coinType: this.coinId
    });

    if (isSendAll) {
      for (const output of outputList) {
        if (output) {
          output.value = undefined;
        }
      }
    }

    // Convert BigNumber to JS Number
    for (const output of outputList) {
      if (output) {
        newOutputList.push({
          address: output.address,
          value: output.value ? output.value.toNumber() : undefined
        });
      }
    }

    // coinselect takes fees in satoshi per byte
    // parsing the fees in satoshi per byte only now
    // feeRate = Math.round(feeRate / 1024);
    let inputs;
    let outputs;
    let fee;

    // Try first with unblocked UTXOs
    if (isSendAll) {
      ({ inputs, outputs, fee } = coinselectSplit(
        utxosFiltered,
        newOutputList,
        feeRate
      ));
    } else {
      ({ inputs, outputs, fee } = coinselect(
        utxosFiltered,
        newOutputList,
        feeRate
      ));
    }

    logger.info('Txn data: With blocked', {
      inputs,
      outputs,
      fee,
      coin: this.coinId
    });

    if (!inputs || !outputs) {
      //Retry again with blocked UTXOs
      if (isSendAll) {
        ({ inputs, outputs, fee } = coinselectSplit(
          utxosWithBlocked,
          newOutputList,
          feeRate
        ));
      } else {
        ({ inputs, outputs, fee } = coinselect(
          utxosWithBlocked,
          newOutputList,
          feeRate
        ));
      }

      logger.info('Txn data: Without blocked', {
        inputs,
        outputs,
        fee,
        coin: this.coinId
      });

      // If we get inputs and outputs then it means there is suffcient
      // confirmed balance. So throw its respective error.
      if (inputs && outputs) {
        throw new WalletError(
          WalletErrorType.BLOCKED_UTXOS_WITH_SUFFICIENT_BALANCE
        );
      }
      // If still no inputs/outputs, then there are no insufficient funds
      throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
    }

    return { inputs, outputs, fee };
  }

  public async approximateTxnFee(
    outputList: Output[],
    feeRate: number,
    isSendAll?: boolean
  ): Promise<{ fees: number; outputs: any }> {
    try {
      logger.verbose('Approximating Txn Fee', {
        coin: this.coinId
      });

      const { outputs, fee } = await this.calcTransactionData(
        outputList,
        feeRate,
        isSendAll
      );

      return {
        fees: fee,
        outputs
      };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async generateMetaData(
    outputList: Output[],
    feeRate: number,
    sdkVersion: string,
    isSendAll?: boolean
  ): Promise<{ metaData: string; fees: number; inputs: any; outputs: any }> {
    try {
      logger.verbose('Generating Meta data', {
        coin: this.coinId
      });
      const purposeIndex = '8000002c';
      const coin = BTCCOINS[this.coinId];
      if (!coin) {
        throw new Error(`Cannot find coinType: ${this.coinId}`);
      }
      const coinIndex = coin.coinIndex;
      const accountIndex = '80000000';

      const { inputs, outputs, fee } = await this.calcTransactionData(
        outputList,
        feeRate,
        isSendAll
      );

      const changeAddress = await this.newChangeAddress();

      const inputsCount = inputs.length;

      let inputString = '';

      for (const input of inputs) {
        const addrIndex = await this.getChainAddressIndex(input.address);
        inputString += intToUintByte(addrIndex.chainIndex, 32);
        inputString += intToUintByte(addrIndex.addressIndex, 32);
      }

      const outputCount = outputs.length;
      const outputString = '0000000000000000';

      let changeCount = 0;
      let changeString = '';

      // outputs ki zaroorat bhi nai hai.. even for change.. cause that is not used in signing.
      for (const output of outputs) {
        if (!('address' in output)) {
          const addrIndex = await this.getChainAddressIndex(changeAddress);
          changeString += intToUintByte(addrIndex.chainIndex, 32);
          changeString += intToUintByte(addrIndex.addressIndex, 32);
          changeCount++;
        }
      }

      const decimalDummyPadding = intToUintByte(0, 8);
      let transactionFeesDummyPadding;
      let contractDummyPadding;
      if (isFeatureEnabled(FeatureName.TokenNameRestructure, sdkVersion)) {
        transactionFeesDummyPadding = intToUintByte(feeRate, 64);
        contractDummyPadding = '00';
      } else {
        transactionFeesDummyPadding = intToUintByte(feeRate, 32);
        contractDummyPadding = '0000000000000000';
      }
      const longChainId = isFeatureEnabled(
        FeatureName.EvmLongChainId,
        sdkVersion
      );

      return {
        metaData:
          purposeIndex +
          coinIndex +
          accountIndex +
          intToUintByte(inputsCount, 8) +
          inputString +
          intToUintByte(outputCount, 8) +
          outputString +
          intToUintByte(changeCount, 8) +
          changeString +
          transactionFeesDummyPadding +
          decimalDummyPadding +
          contractDummyPadding +
          intToUintByte(0, longChainId ? 64 : 8) + // Dummy chain Index
          (longChainId ? '00' : ''), // not a harmony address
        fees: fee,
        inputs,
        outputs
      };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public async generateUnsignedTransaction(
    outputList: Output[],
    feeRate: number,
    isSendAll?: boolean
  ): Promise<{
    txn: string;
    amount: string;
    fee: string;
    inputs: Array<{
      txId: string;
      vout: number;
      value: number;
      address: string;
      isMine: boolean;
    }>;
    outputs: Array<{ value: number; address: string; isMine: boolean }>;
    utxoList: string[];
  }> {
    // This is because we need to mark our addresses
    if (!this.addressDB) {
      throw new Error('Address DB is required for this action');
    }

    try {
      logger.verbose('Generating unsigned transactions', {
        coin: this.coinId
      });

      let myAddresses: string[] = [];

      // Get all addresses of that xpub and coin
      // This is because the address from the API is of only 1 wallet,
      // Whereas there are 2 (or 4 in case od BTC & BTCT) wallets.
      const addressFromDB = await this.addressDB.getAll({
        accountId: this.accountId
      });

      if (addressFromDB && addressFromDB.length > 0) {
        myAddresses = myAddresses.concat(
          addressFromDB.map((elem: any) => elem.address)
        );
      }

      const { inputs, outputs, fee } = await this.calcTransactionData(
        outputList,
        feeRate,
        isSendAll
      );

      const changeAddress = await this.newChangeAddress();
      for (const output of outputs) {
        if (!('address' in output)) {
          output.address = changeAddress;
          output.isMine = true;
        } else {
          output.isMine = myAddresses.includes(output.address);
        }
      }

      const utxoList = [];

      for (const input of inputs) {
        const response = await bitcoinServer.transaction
          .getTxnHex({
            coinType: BTCCOINS[this.coinId].abbr,
            hash: input.txId
          })
          .request();
        const hex = response.data.data;
        utxoList.push(hex);
        input.isMine = true;
      }

      return {
        amount: outputs[0].value ? outputs[0].value.toString() : '',
        fee: fee ? fee.toString() : '',
        txn: createSegwitTransaction(inputs, outputs, this.network),
        inputs,
        outputs,
        utxoList
      };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  public getSignedTransaction(
    unsignedTransaction: string,
    inputSignatures: string[]
  ): string {
    let signedTxn: string | undefined;
    try {
      logger.verbose('Generating signed transaction', {
        coin: this.coinId
      });
      signedTxn = createSegwitSignedTransaction(
        unsignedTransaction,
        inputSignatures
      );
    } catch (error) {
      logger.error(error);
      throw error;
    }

    if (!signedTxn) {
      throw new Error('Unable to create signed transaction');
    }

    // Clear all UTXO cache after generating each signed txn
    this.clearAllUtxoCache();
    return signedTxn;
  }

  public async verifySignedTxn(
    signedTxn: string,
    inputs: Array<{ value: number }>
  ) {
    return verifyTxn(signedTxn, inputs);
  }

  /**
   * This is used to setup if the wallet is being added.
   */
  public async setupNewWallet() {
    // This is because we maintain the list of created addresses while setting up the wallet.
    if (!this.addressDB) {
      throw new Error('Address DB is required for this action');
    }

    await this.getInitialAddressListFromServer();
  }

  private async getInitialAddressListFromServer() {
    if (!this.addressDB) {
      throw new Error('Address DB is required for this action');
    }

    const xResp = await v2Server
      .getUsedAddresses({
        xpub: this.xpub,
        coinType: BTCCOINS[this.coinId].abbr
      })
      .request();

    if (xResp.data.tokens && xResp.data.tokens.length > 0) {
      const addressDbList = [];
      for (const token of xResp.data.tokens) {
        const { name: address, path, type } = token;
        if (type !== 'XPUBAddress') {
          continue;
        }

        const pathArr = path.split('/');
        const chainIndex = parseInt(pathArr[pathArr.length - 2], 10);
        const addressIndex = parseInt(pathArr[pathArr.length - 1], 10);

        addressDbList.push({
          accountId: this.accountId,
          address,
          walletId: this.walletId,
          coinId: this.coinId,
          chainIndex,
          addressIndex,
          isSegwit: false
        });
      }
      await this.addressDB.insertMany(addressDbList);
    }
  }

  private generateAddress(
    chain: number,
    index: number,
    preferSegwit?: boolean
  ) {
    const isSegwit = this.modifiedZpub !== undefined && !!preferSegwit;
    let address: string | undefined;
    if (isSegwit) {
      address = getSegwitAddress(
        this.modifiedZpub || '',
        this.coinId === BTCCOINS.btct.abbr,
        this.network,
        chain,
        index
      );
    } else {
      address = bitcoin.payments.p2pkh({
        pubkey: bip32
          .fromBase58(this.xpub, this.network)
          .derive(chain)
          .derive(index).publicKey,
        network: this.network
      }).address;
    }

    if (!address) {
      throw new Error('Error in deriving address');
    }

    logger.info('New addresses', {
      coinType: this.coinId,
      address,
      chain,
      index,
      isSegwit
    });

    if (this.addressDB) {
      this.addressDB.insert({
        accountId: this.accountId,
        address,
        walletId: this.walletId,
        coinId: this.coinId,
        chainIndex: chain,
        addressIndex: index,
        isSegwit
      });
    }

    return address;
  }

  private async getUsedAddressListFromServer(
    isSegwit: boolean,
    isRefresh?: boolean
  ): Promise<AddressDataList> {
    const resp = await v2Server
      .getUsedAddresses(
        {
          xpub: this.xpub,
          coinType: BTCCOINS[this.coinId].abbr
        },
        isRefresh
      )
      .request();

    // rChain: Chain index 0, cChain: Chain Index 1
    const data: AddressDataList = { rChain: [], cChain: [] };

    if (!(resp && resp.data && resp.data.tokens)) {
      return data;
    }

    const addressDbList = [];

    for (const token of resp.data.tokens) {
      const { name: address, path, type } = token;

      if (type !== 'XPUBAddress') {
        continue;
      }

      const pathArr = path.split('/');
      const chainIndex = parseInt(pathArr[pathArr.length - 2], 10);
      const addressIndex = parseInt(pathArr[pathArr.length - 1], 10);

      if (this.addressDB) {
      }
      addressDbList.push({
        accountId: this.accountId,
        address,
        walletId: this.walletId,
        coinId: this.coinId,
        chainIndex,
        addressIndex,
        isSegwit
      });

      const addressData = {
        addressIndex,
        address
      };

      if (chainIndex === 0) {
        data.rChain.push(addressData);
      } else if (chainIndex === 1) {
        data.cChain.push(addressData);
      }
    }
    if (this.addressDB) {
      await this.addressDB.insertMany(addressDbList);
    }

    return data;
  }

  private async fetchUtxos(xpub: string) {
    if (!this.transactionDB) {
      throw new Error('Transaction DB is required for this action');
    }
    const utxos: any = [];

    const response: AxiosResponse = await v2Server
      .getUtxo({
        coinType: BTCCOINS[this.coinId].abbr,
        xpub
      })
      .request();

    const txrefs = response.data || [];

    await Promise.all(
      txrefs.map(async (txref: any) => {
        const utxo = {
          address: txref.address,
          txId: txref.txid,
          vout: txref.vout,
          value: parseInt(txref.value, 10),
          block_height: txref.height,
          confirmations: txref.confirmations
        };
        const transaction = await this.transactionDB?.getOne({
          hash: txref.txid
        });
        // Add blocked state to utxo
        utxos.push({
          ...utxo,
          blocked: transaction?.blockedInputs?.includes(utxo.vout)
        });
      })
    );

    return utxos;
  }

  private async fetchAllUtxos() {
    if (!this.transactionDB) {
      throw new Error('Transaction DB is required for this action');
    }
    const key = `utxo-${this.xpub}`;
    const cachedUtxos: any[] | undefined = mcache.get(key);

    // Release all the blocked UTXOs if the timeout has expired.
    // This is done here so they could be reused in the current transaction
    // if they are not included in any transaction. This also shouldn't
    // cause any issue if the UTXO has already been used. In that case, the
    // blockchain itself will identify it as spent.
    await this.transactionDB?.releaseBlockedTxns();

    if (cachedUtxos) {
      const processedUtxos: any[] = [];

      await Promise.all(
        cachedUtxos.map(async utxo => {
          const transaction = await this.transactionDB?.getOne({
            hash: utxo.txId
          });
          // Add blocked state to utxo
          processedUtxos.push({
            ...utxo,
            blocked: transaction?.blockedInputs?.includes(utxo.vout)
          });
        })
      );
      logger.info('UTXO from cache', { coin: this.coinId });

      logger.debug('UTXO from cache', {
        cachedUtxos: processedUtxos,
        coin: this.coinId
      });
      return processedUtxos;
    }

    const utxos: any = [];
    const xUtxo = await this.fetchUtxos(this.xpub);

    utxos.push(...xUtxo);

    const includedUtxoMap: { [key: string]: boolean } = {};
    const utxoList = [];

    // Don't allow duplicate utxo
    for (const utxo of utxos) {
      const utxoKey = `${utxo.address}-${utxo.txId}-${utxo.vout}`;
      if (!(utxoKey in includedUtxoMap)) {
        includedUtxoMap[utxoKey] = true;
        utxoList.push(utxo);
      }
    }

    mcache.set(key, utxoList, 90);
    logger.debug('All Utxos', { utxoList, coin: this.coinId });
    return utxoList;
  }

  private clearAllUtxoCache() {
    const key = `utxo-${this.xpub}`;
    mcache.del(key);

    v2Server
      .getUtxo({
        coinType: BTCCOINS[this.coinId].abbr,
        xpub: this.xpub
      })
      .clearCache();
  }

  private async newAddress(
    chain: number,
    _inRecursive?: boolean
  ): Promise<string> {
    const isSegwit = this.modifiedZpub !== undefined;

    const data = await this.getUsedAddressListFromServer(isSegwit);

    let highestIndex = -1;

    const addressList = chain === 0 ? data.rChain : data.cChain;

    for (const address of addressList) {
      if (address.addressIndex > highestIndex) {
        highestIndex = address.addressIndex;
      }
    }

    return this.generateAddress(chain, highestIndex + 1, isSegwit);
  }
}
