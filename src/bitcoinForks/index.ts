import { AxiosResponse } from 'axios';
import { BTCCOINS } from '@cypherock/communication';
import {
  bitcoin as bitcoinServer,
  v2 as v2Server
} from '@cypherock/server-wrapper';
import * as bip32 from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import { AddressDB } from '@cypherock/database';
import crypto from 'crypto';

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

export default class BitcoinWallet implements IWallet {
  xpub: string;
  modifiedZpub?: string;
  zpub?: string;
  coinType: string;
  external: string;
  internal: string;
  segwitExternal: string;
  segwitInternal: string;
  network: any;
  addressDB: AddressDB | undefined;
  walletId: string;

  constructor(
    xpub: string,
    coinType: string,
    walletId: string,
    zpub?: string,
    addressDb?: AddressDB
  ) {
    this.xpub = xpub;
    this.walletId = walletId;
    this.segwitExternal = '';
    this.segwitInternal = '';
    if (zpub !== undefined && BTCCOINS[coinType].hasSegwit) {
      this.modifiedZpub = convertZpub(zpub, coinType === BTCCOINS.btct.abbr);
      this.zpub = zpub;
      const segwitHash = crypto
        .createHash('sha256')
        .update(zpub)
        .digest('hex')
        .slice(0, 24); // We need to use first 32 characters, but blockcypher allows max of 25

      this.segwitExternal = `r${segwitHash}`;
      this.segwitInternal = `c${segwitHash}`;
    }
    this.coinType = coinType;
    this.addressDB = addressDb;
    const hash = crypto
      .createHash('sha256')
      .update(xpub)
      .digest('hex')
      .slice(0, 24); // We need to use first 32 characters, but blockcypher allows max of 25

    this.external = `r${hash}`;
    this.internal = `c${hash}`;
    logger.info('Wallet data', {
      coin: this.coinType,
      internal: this.internal,
      external: this.external
    });

    switch (coinType) {
      case BTCCOINS.btc.abbr:
        this.network = bitcoin.networks.bitcoin;
        break;

      case BTCCOINS.btct.abbr:
        this.network = bitcoin.networks.testnet;
        break;

      case BTCCOINS.ltc.abbr:
        this.network = networks.litecoin;
        break;

      case BTCCOINS.dash.abbr:
        this.network = networks.dash;
        break;

      case BTCCOINS.doge.abbr:
        this.network = networks.dogecoin;
        break;

      default:
        throw new Error('Please Provide a Valid Coin Type');
    }
  }

  public async newReceiveAddress(): Promise<string> {
    return await this.newAddress(0);
  }

  public async newChangeAddress(): Promise<string> {
    return await this.newAddress(1);
  }

  async getBalance(chain: number, isSegwit?: boolean): Promise<any> {
    let walletName: string;
    if (chain === 0) {
      walletName = isSegwit ? this.segwitExternal : this.external;
    } else {
      walletName = isSegwit ? this.segwitInternal : this.internal;
    }

    const response: any = await bitcoinServer.wallet
      .getBalance({
        coinType: this.coinType,
        walletName
      })
      .request();

    const { balance } = response.data;
    const { unconfirmed_balance } = response.data;
    const { final_balance } = response.data;

    return {
      balance,
      unconfirmedBalance: unconfirmed_balance,
      finalBalance: final_balance
    };
  }

  async getTotalBalance(): Promise<any> {
    try {
      const receiveBalance: any = await this.getBalance(0);

      const changeBalance: any = await this.getBalance(1);

      const segwitBalance = {
        balance: 0,
        unconfirmedBalance: 0,
        finalBalance: 0
      };

      if (this.zpub !== undefined) {
        const segwitReceiveBalance = await this.getBalance(0, true);
        const segwitChangeBalance = await this.getBalance(1, true);
        segwitBalance.balance =
          segwitReceiveBalance.balance + segwitChangeBalance.balance;
        segwitBalance.unconfirmedBalance =
          segwitReceiveBalance.unconfirmedBalance +
          segwitChangeBalance.unconfirmedBalance;
        segwitBalance.finalBalance =
          segwitReceiveBalance.finalBalance + segwitChangeBalance.finalBalance;
      }

      return {
        balance:
          changeBalance.balance +
          receiveBalance.balance +
          segwitBalance.balance,
        unconfirmedBalance:
          changeBalance.unconfirmedBalance +
          receiveBalance.unconfirmedBalance +
          segwitBalance.unconfirmedBalance,
        finalBalance:
          changeBalance.finalBalance +
          receiveBalance.finalBalance +
          segwitBalance.finalBalance
      };
    } catch (e) {
      logger.error(e);
    }
    return {
      balance: 0,
      unconfirmedBalance: 0,
      finalBalance: 0
    };
  }

  public async getChainAddressIndex(
    address: string
  ): Promise<{ chainIndex: number; addressIndex: number; isSegwit: boolean }> {
    if (this.addressDB) {
      const cacheResult = await this.addressDB.getChainIndex({
        address,
        walletId: this.walletId,
        coinType: this.coinType
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
        coinType: this.coinType,
        chainIndex: res.chainIndex,
        addressIndex: res.addressIndex,
        isSegwit: res.isSegwit
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
      this.zpub !== undefined &&
      (address.startsWith('bc') || address.startsWith('tb'));

    if (isSegwit) {
      for (let i = 0; i < 1000; i++) {
        if (
          address ===
          getSegwitAddress(
            this.modifiedZpub || '',
            this.coinType === BTCCOINS.btct.abbr,
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
            this.coinType === BTCCOINS.btct.abbr,
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

  async getDerivationPath(address: string): Promise<any> {
    const coinIndex = BTCCOINS[this.coinType].coinIndex;
    const accountIndex = '80000000';

    const addressInfo = await this.getChainAddressIndex(address);

    const purposeIndex = addressInfo.isSegwit ? '80000054' : '8000002c';
    const chainIndex = intToUintByte(addressInfo.chainIndex, 32);
    const addressIndex = intToUintByte(addressInfo.addressIndex, 32);
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

  public async calcTransactionData(
    outputList: Output[],
    feeRate: any,
    isSendAll?: boolean
  ): Promise<{ inputs: any; outputs: any; fee: any }> {
    const utxos: any[] = await this.fetchAllUtxos();
    const newOutputList: Array<{ address: string; value?: number }> = [];

    logger.info('Generating tx data for', {
      outputList,
      feeRate,
      isSendAll,
      coinType: this.coinType
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

    if (isSendAll) {
      ({ inputs, outputs, fee } = coinselectSplit(
        utxos,
        newOutputList,
        feeRate
      ));
    } else {
      ({ inputs, outputs, fee } = coinselect(utxos, newOutputList, feeRate));
    }

    logger.info('Txn data', { inputs, outputs, fee, coin: this.coinType });

    if (!inputs || !outputs) {
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
        coin: this.coinType
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
    isSendAll?: boolean
  ): Promise<{ metaData: string; fees: number; inputs: any; outputs: any }> {
    try {
      logger.verbose('Generating Meta data', {
        coin: this.coinType
      });
      const purposeIndex = '8000002c';
      const coin = BTCCOINS[this.coinType];
      if (!coin) {
        throw new Error(`Cannot find coinType: ${this.coinType}`);
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
      const contractDummyPadding = '0000000000000000';

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
          intToUintByte(feeRate, 32) +
          decimalDummyPadding +
          contractDummyPadding +
          '00', // Dummy chain Index
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
        coin: this.coinType
      });

      let myAddresses: string[] = [];

      // Get all addresses of that xpub and coin
      // This is because the address from the API is of only 1 wallet,
      // Whereas there are 2 (or 4 in case od BTC & BTCT) wallets.
      const addressFromDB = await this.addressDB.getAll({
        walletId: this.walletId,
        coinType: this.coinType
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
            coinType: this.coinType,
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
        coin: this.coinType
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
        coinType: this.coinType
      })
      .request();

    if (xResp.data.tokens && xResp.data.tokens.length > 0) {
      for (const token of xResp.data.tokens) {
        const { name: address, path, type } = token;
        if (type !== 'XPUBAddress') {
          continue;
        }

        const pathArr = path.split('/');
        const chainIndex = parseInt(pathArr[pathArr.length - 2], 10);
        const addressIndex = parseInt(pathArr[pathArr.length - 1], 10);

        await this.addressDB.insert({
          address,
          walletId: this.walletId,
          coinType: this.coinType,
          chainIndex,
          addressIndex,
          isSegwit: false
        });
      }
    }

    if (this.zpub) {
      const zResp = await v2Server
        .getUsedAddresses({
          xpub: this.zpub,
          coinType: this.coinType
        })
        .request();

      if (zResp.data.tokens && zResp.data.tokens.length > 0) {
        for (const token of zResp.data.tokens) {
          const { name: address, path, type } = token;
          if (type !== 'XPUBAddress') {
            continue;
          }

          const pathArr = path.split('/');
          const chainIndex = parseInt(pathArr[pathArr.length - 2], 10);
          const addressIndex = parseInt(pathArr[pathArr.length - 1], 10);

          await this.addressDB.insert({
            address,
            coinType: this.coinType,
            walletId: this.walletId,
            chainIndex,
            addressIndex,
            isSegwit: true
          });
        }
      }
    }
  }

  private generateAddress(
    chain: number,
    index: number,
    preferSegwit?: boolean
  ) {
    const isSegwit = this.zpub !== undefined && !!preferSegwit;
    let address: string | undefined;
    if (isSegwit) {
      address = getSegwitAddress(
        this.modifiedZpub || '',
        this.coinType === BTCCOINS.btct.abbr,
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
      coinType: this.coinType,
      address,
      chain,
      index,
      isSegwit
    });

    if (this.addressDB) {
      this.addressDB.insert({
        address,
        walletId: this.walletId,
        coinType: this.coinType,
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
          xpub: isSegwit ? this.zpub || '' : this.xpub,
          coinType: this.coinType
        },
        isRefresh
      )
      .request();

    // rChain: Chain index 0, cChain: Chain Index 1
    const data: AddressDataList = { rChain: [], cChain: [] };

    if (!(resp && resp.data && resp.data.tokens)) {
      return data;
    }

    for (const token of resp.data.tokens) {
      const { name: address, path, type } = token;

      if (type !== 'XPUBAddress') {
        continue;
      }

      const pathArr = path.split('/');
      const chainIndex = parseInt(pathArr[pathArr.length - 2], 10);
      const addressIndex = parseInt(pathArr[pathArr.length - 1], 10);

      if (this.addressDB) {
        await this.addressDB.insert({
          address,
          walletId: this.walletId,
          coinType: this.coinType,
          chainIndex,
          addressIndex,
          isSegwit
        });
      }

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

    return data;
  }

  private async fetchUtxos(xpub: string) {
    const utxos: any = [];

    const response: AxiosResponse = await v2Server
      .getUtxo({
        coinType: this.coinType,
        xpub
      })
      .request();

    const txrefs = response.data || [];

    txrefs.forEach((txref: any) => {
      const utxo = {
        address: txref.address,
        txId: txref.txid,
        vout: txref.vout,
        value: parseInt(txref.value, 10),
        block_height: txref.height,
        confirmations: txref.confirmations
      };
      utxos.push(utxo);
    });

    return utxos;
  }

  private async fetchAllUtxos() {
    const key = `utxo-${this.external}`;
    const cachedUtxos: any[] | undefined = mcache.get(key);
    if (cachedUtxos) {
      logger.info('UTXO from cache', { coin: this.coinType });
      logger.debug('UTXO from cache', { cachedUtxos, coin: this.coinType });
      return cachedUtxos;
    }

    const utxos: any = [];

    const xUtxo = await this.fetchUtxos(this.xpub);

    utxos.push(...xUtxo);

    if (this.zpub !== undefined) {
      const zUtxo = await this.fetchUtxos(this.zpub);

      utxos.push(...zUtxo);
    }

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
    logger.debug('All Utxos', { utxoList, coin: this.coinType });
    return utxoList;
  }

  private clearAllUtxoCache() {
    const key = `utxo-${this.external}`;
    mcache.del(key);

    v2Server
      .getUtxo({
        coinType: this.coinType,
        xpub: this.xpub
      })
      .clearCache();

    if (this.zpub !== undefined) {
      v2Server
        .getUtxo({
          coinType: this.coinType,
          xpub: this.zpub
        })
        .clearCache();
    }
  }

  private async newAddress(
    chain: number,
    _inRecursive?: boolean
  ): Promise<string> {
    const isSegwit = this.zpub !== undefined;

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
