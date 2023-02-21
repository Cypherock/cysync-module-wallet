import Common from '@ethereumjs/common';
import { TxData, TransactionFactory } from '@ethereumjs/tx';
import {
  EthCoinData,
  EthCoinMap,
  ETHCOINS,
  FeatureName,
  isFeatureEnabled
} from '@cypherock/communication';
import bech32 from 'bech32';
import BigNumber from 'bignumber.js';
import { utils } from 'ethers';
import * as RLP from 'rlp';
import Web3 from 'web3';
import IWallet from '../interface/wallet';
import verifyTxn from './txVerifier';
import { logger } from '../utils';
import { getBalance, getDecimal, getTransactionCount } from './client';
import { WalletError, WalletErrorType } from '../errors';
import { bufArrToArr } from '@ethereumjs/util/dist/bytes';
import { formatHarmonyAddress } from '../utils/formatEthAddress';
import { toHexString } from '../utils/uint8ArrayFromHexString';
import { MessageData, MessageData_MessageType } from './eip712MsgData.pb';
import { addEIP712TypeFields } from './typedDataUtils';

// In 2 places, put them in one place
const intToUintByte = (ele: any, radix: number) => {
  const val = Number(ele).toString(16);
  const noOfZeroes = radix / 4 - val.length;
  let res = '';
  for (let i = 0; i < noOfZeroes; i += 1) {
    res += '0';
  }
  return res + val;
};

export default class EthereumWallet implements IWallet {
  xpub: string;
  web3: Web3;
  address: string;
  minABI: any;
  node: number;
  network: string;
  coin: EthCoinData;
  evmAddress: string;
  accountIndex: number;

  constructor(accountIndex: number, xpub: string, coin: EthCoinData, node = 0) {
    this.accountIndex = accountIndex;
    this.node = node;
    this.xpub = xpub;
    this.coin = coin;
    this.network = coin.network;
    this.web3 = new Web3();
    this.address = utils.HDNode.fromExtendedKey(xpub).derivePath(
      `0/${node}`
    ).address;
    this.minABI = [
      {
        constant: false,
        inputs: [
          {
            name: '_to',
            type: 'address'
          },
          {
            name: '_value',
            type: 'uint256'
          }
        ],
        name: 'transfer',
        outputs: [
          {
            name: 'success',
            type: 'bool'
          }
        ],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function'
      },
      // balanceOf
      {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function'
      },
      // decimals
      {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function'
      }
    ];
    this.evmAddress = this.address;
    if (this.coin.coinListId === ETHCOINS[EthCoinMap.harmony].coinListId) {
      this.address = formatHarmonyAddress(this.evmAddress);
    }
  }

  public static getProtocolDerivationPath(params: {
    accountIndex: number;
    accountType: string;
    coinIndex: string;
    chainId: number;
  }) {
    return (
      intToUintByte(3, 8) +
      intToUintByte(0x80000000 + 44, 8 * 4) +
      params.coinIndex +
      intToUintByte(0x80000000 + params.accountIndex, 8 * 4) +
      intToUintByte(params.chainId, 64)
    );
  }

  public static getDerivationPath(params: {
    accountIndex: number;
    accountType: string;
    coinIndex: string;
    chainId: number;
  }) {
    const coinIndex = parseInt(params.coinIndex, 16) - 0x80000000;
    return `m/44'/${coinIndex}'/${params.accountIndex}'/0/0`;
  }

  public generateContractData(
    contractAddress: string,
    receiverAddress: string,
    totalAmount: BigNumber
  ): string {
    if (!contractAddress || !receiverAddress) return '0x';

    const contract = new this.web3.eth.Contract(this.minABI, contractAddress, {
      from: this.evmAddress
    });

    return contract.methods
      .transfer(receiverAddress, totalAmount.toString(10))
      .encodeABI();
  }

  public async setupNewWallet() {
    // Setup code here
  }

  public async approximateTxnFee(
    amount: BigNumber | undefined,
    gasPrice: number,
    gasLimit: number,
    isSendAll?: boolean,
    contractAddress?: string
  ): Promise<{ fees: BigNumber; amount: BigNumber }> {
    logger.verbose('Approximating Txn Fee', {
      address: this.address,
      evmAddress: this.evmAddress
    });

    logger.info('Approximating Txn Fee data', {
      amount,
      gasPrice,
      gasLimit,
      isSendAll,
      contractAddress
    });

    let totalAmount = new BigNumber(0);
    if (amount) {
      totalAmount = amount;
    }

    const ethBalance = new BigNumber((await this.getTotalBalance()).balance);

    logger.info('Eth balance', { ethBalance });

    // From Gwei to wei
    const totalFee = new BigNumber(gasPrice * gasLimit)
      .multipliedBy(new BigNumber(Math.pow(10, 9)))
      .decimalPlaces(0);
    logger.info('Total fee', { totalFee });

    if (contractAddress) {
      const contractBalance = new BigNumber(
        (await this.getTotalBalance(contractAddress)).balance
      );

      logger.info('Contract balance', {
        contractBalance,
        address: this.address
      });

      if (isSendAll) {
        totalAmount = contractBalance;
      }

      if (
        ethBalance.isLessThan(totalFee) ||
        contractBalance.isLessThan(totalAmount)
      ) {
        throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
      }
    } else {
      if (isSendAll) {
        totalAmount = ethBalance.minus(totalFee);
        if (totalAmount.isNegative()) {
          throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
        }
      }

      if (ethBalance.isLessThan(totalAmount.plus(totalFee))) {
        throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
      }
    }

    return { fees: totalFee, amount: totalAmount };
  }

  async generateMetaData(
    sdkVersion: string,
    contractAddress?: string,
    contractAbbr: string = 'ETH',
    isHarmonyAddress: boolean = false
  ): Promise<string> {
    logger.info('Generating metadata for', {
      address: this.address,
      contractAddress,
      contractAbbr
    });
    const purposeIndex = '8000002c';
    const coinIndex = this.coin.coinIndex;
    const accountIndex = intToUintByte(0x80000000 + this.accountIndex, 8 * 4);

    const inputCount = 1;
    const chainIndex = 0;
    const addressIndex = this.node;
    const inputString =
      intToUintByte(chainIndex, 32) + intToUintByte(addressIndex, 32);

    const outputCount = 1;
    const outputString = '0000000000000000';

    const changeCount = 1;
    const changeString = '0000000000000000';

    // this field is not used on the device, the transaction fees is calculated from the unsigned txn
    let gas;
    let decimal = intToUintByte(18, 8);
    if (contractAddress)
      decimal = intToUintByte(
        await getDecimal(this.network, contractAddress),
        8
      );

    let contract;

    if (isFeatureEnabled(FeatureName.TokenNameRestructure, sdkVersion)) {
      gas = intToUintByte(0, 64);
      contract =
        Buffer.from(contractAbbr.toUpperCase(), 'utf-8').toString('hex') + '00';
    } else {
      gas = intToUintByte(0, 32);
      contract = Buffer.from(contractAbbr.toUpperCase(), 'utf-8')
        .toString('hex')
        .slice(0, 14)
        .padEnd(16, '0');
    }
    // 8 byte name
    // contract = contract + '0'.repeat(16 - contract.length);
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
      gas +
      decimal +
      contract +
      intToUintByte(this.coin.chain, longChainId ? 64 : 8) +
      (longChainId ? intToUintByte(isHarmonyAddress ? 1 : 0, 8) : '') + // could be harmony address
      intToUintByte(0, 16) // account type
    );
  }

  // gas price in gwei
  async generateUnsignedTransaction(params: {
    outputAddress: string;
    amount: BigNumber;
    gasPrice: number;
    gasLimit: number;
    chain?: number;
    isSendAll: boolean;
    contractAddress?: string;
    contractData?: string;
    nonce?: string;
  }): Promise<{
    txn: string;
    amount: BigNumber;
    fee: BigNumber;
    inputs: Array<{
      value: string;
      address: string;
      isMine: boolean;
    }>;
    outputs: Array<{ value: string; address: string; isMine: boolean }>;
  }> {
    const {
      outputAddress,
      amount,
      gasPrice,
      gasLimit,
      chain = 1,
      isSendAll,
      contractAddress,
      contractData,
      nonce
    } = params;

    logger.info('Generating unsignedTxn for', {
      address: this.address,
      outputAddress,
      amount,
      gasPrice,
      gasLimit,
      chain,
      contractAddress,
      contractData,
      nonce
    });

    let evmAddress = outputAddress;
    if (
      chain === ETHCOINS[EthCoinMap.harmony].chain &&
      outputAddress.startsWith('one1')
    ) {
      // convert Harmony's bech32 addresses to hexstring address
      // since the recipient is validated, no scope for errors
      const { words } = bech32.decode(outputAddress);
      evmAddress = toHexString(new Uint8Array(bech32.fromWords(words)));
    }
    // Convert from lowercase address to mixed case for easier comparison
    const mixedCaseOutputAddr = utils.getAddress(evmAddress);

    let rawTx: TxData;

    let totalAmount = new BigNumber(0);
    if (amount) {
      totalAmount = amount;
    }

    logger.verbose('Generating unsignedTxn', { address: this.address });

    const ethBalance = new BigNumber((await this.getTotalBalance()).balance);
    logger.info('Eth balance', {
      ethBalance: ethBalance.toString(),
      address: this.address
    });

    // From Gwei to wei
    const totalFee = new BigNumber(gasPrice * gasLimit)
      .multipliedBy(new BigNumber(Math.pow(10, 9)))
      .decimalPlaces(0);
    logger.info('Total fee', { totalFee, address: this.address });
    const convertedGasPrice = new BigNumber(gasPrice)
      .multipliedBy(1000000000)
      .decimalPlaces(0);

    if (contractData) {
      rawTx = {
        // call from server.
        nonce: nonce ?? (await getTransactionCount(this.address, this.network)),
        gasPrice: this.web3.utils.toHex(convertedGasPrice.toString()),
        gasLimit: this.web3.utils.toHex(gasLimit),
        to: contractAddress || mixedCaseOutputAddr,
        value: this.web3.utils.toHex(totalAmount.toString(10)),
        data: contractData
      };
    } else if (contractAddress) {
      const contractBalance = new BigNumber(
        (await this.getTotalBalance(contractAddress)).balance
      );

      logger.info('Contract balance', {
        contractBalance,
        address: this.address
      });

      if (isSendAll) {
        totalAmount = contractBalance;
      }

      if (
        ethBalance.isLessThan(totalFee) ||
        contractBalance.isLessThan(totalAmount)
      ) {
        throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
      }

      const data = this.generateContractData(
        contractAddress,
        mixedCaseOutputAddr,
        totalAmount
      );

      rawTx = {
        // call from server.
        nonce: await getTransactionCount(this.evmAddress, this.network),
        gasPrice: this.web3.utils.toHex(convertedGasPrice.toString()),
        gasLimit: this.web3.utils.toHex(gasLimit),
        to: contractAddress,
        value: '0x0',
        data: Buffer.from(data, 'utf8')
      };
    } else {
      if (isSendAll) {
        totalAmount = ethBalance.minus(totalFee);
        if (totalAmount.isNegative()) {
          throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
        }
      }

      if (ethBalance.isLessThan(totalAmount.plus(totalFee))) {
        throw new WalletError(WalletErrorType.INSUFFICIENT_FUNDS);
      }

      rawTx = {
        // call from server
        nonce: await getTransactionCount(this.evmAddress, this.network),
        gasPrice: this.web3.utils.toHex(convertedGasPrice.toString()),
        gasLimit: this.web3.utils.toHex(gasLimit),
        to: mixedCaseOutputAddr,
        value: this.web3.utils.toHex(totalAmount.toString(10))
      };
    }
    const common = Common.custom({ chainId: chain });
    const transaction = TransactionFactory.fromTxData(rawTx, {
      common
    });
    // Ref: https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/tx#signing-with-a-hardware-or-external-wallet
    const txHex = Buffer.from(
      RLP.encode(bufArrToArr(transaction.getMessageToSign(false)))
    ).toString('hex');
    logger.info('Calculated amount', { totalAmount });

    return {
      txn: txHex,
      fee: totalFee,
      amount: totalAmount,
      inputs: [
        {
          address: this.evmAddress,
          value: totalAmount.toString(),
          isMine: true
        }
      ],
      outputs: [
        {
          address: mixedCaseOutputAddr,
          value: totalAmount.toString(),
          isMine: this.evmAddress === mixedCaseOutputAddr
        }
      ]
    };
  }
  private async generatePersonalSignMessage(message: string, type: number) {
    if (!message.startsWith('0x')) {
      throw new Error('Message should be in hex');
    }

    logger.info('Generating message hex for', {
      address: this.address,
      message
    });

    const messageObj = MessageData.fromJSON({
      messageType: type,
      dataBytes: new Uint8Array(Buffer.from(message.slice(2), 'hex'))
    });

    const dataToSend = Buffer.from(
      MessageData.encode(messageObj).finish()
    ).toString('hex');

    logger.verbose('Generated message hex', { dataToSend });

    return dataToSend;
  }

  private async generateTypedDataMessage(message: string) {
    try {
      const messageObj = MessageData.fromJSON({
        messageType: MessageData_MessageType.SIGN_TYPED_DATA,
        eip712data: addEIP712TypeFields(JSON.parse(message))
      });
      const dataToSend = Buffer.from(
        MessageData.encode(messageObj).finish()
      ).toString('hex');
      logger.verbose('Generated message hex', { dataToSend });

      return dataToSend;
    } catch (e) {
      throw new Error(`Invalid message detected, ${e}`);
    }
  }

  async generateMessageHex(message: string, type: number): Promise<string> {
    switch (type) {
      case MessageData_MessageType.ETH_SIGN:
      case MessageData_MessageType.PERSONAL_SIGN:
        return this.generatePersonalSignMessage(message, type);
      case MessageData_MessageType.SIGN_TYPED_DATA:
        return this.generateTypedDataMessage(message);
      default:
        throw new Error('Unsupported message type: ' + type);
    }
  }

  async getTotalBalance(contractAddress?: string) {
    // to keep in sync with bitcoin's balance structure in the db
    const bal = {
      balance: await getBalance(this.evmAddress, this.network, contractAddress)
    };

    return bal;
  }

  newReceiveAddress(): string {
    return this.address;
  }

  getSignedTransaction(
    unsignedTxn: string,
    rawValues: string,
    chainId = 1
  ): string {
    logger.verbose('Generating signed txn', { address: this.address });
    const common = Common.custom({ chainId });
    let r = rawValues.slice(0, 64);
    let s = rawValues.slice(64, 128);
    while (r.slice(0, 2) === '00') r = r.slice(2);
    while (s.slice(0, 2) === '00') s = s.slice(2);
    const v = (
      2 * chainId +
      35 +
      (rawValues.slice(128) === '00' ? 0 : 1)
    ).toString(16);
    const [nonce, gasPrice, gasLimit, to, value, data] = RLP.decode(
      Buffer.from(unsignedTxn, 'hex')
    );
    const toStr = (to as any).toString('hex');
    const rawTxn = {
      nonce,
      gasPrice,
      gasLimit,
      to: `0x${toStr}`,
      value,
      data,
      v: `0x${v}`,
      r: `0x${r}`,
      s: `0x${s}`
    };
    return TransactionFactory.fromTxData(rawTxn, { common })
      .serialize()
      .toString('hex');
  }

  public async verifySignedTxn(signedTxn: string) {
    return verifyTxn(signedTxn, this.evmAddress);
  }

  public getDerivationPath(sdkVersion: string, contractAbbr = 'ETH'): string {
    const purposeIndex = '8000002c';
    const coinIndex = this.coin.coinIndex;
    const chainIndex = '00000000';
    //Will only work till the node is < 10
    const addressIndex = '0000000' + this.node;
    let contract;
    if (isFeatureEnabled(FeatureName.TokenNameRestructure, sdkVersion))
      contract =
        Buffer.from(contractAbbr.toUpperCase(), 'utf-8').toString('hex') + '00';
    else {
      contract = Buffer.from(contractAbbr.toUpperCase(), 'utf-8')
        .toString('hex')
        .slice(0, 14)
        .padEnd(16, '0');
      // 8 byte name
      // contract = contract + '0'.repeat(16 - contract.length);
    }
    const longChainId = isFeatureEnabled(
      FeatureName.EvmLongChainId,
      sdkVersion
    );

    return (
      purposeIndex +
      coinIndex +
      intToUintByte(0x80000000 + this.accountIndex, 32) +
      chainIndex +
      addressIndex +
      contract +
      intToUintByte(this.coin.chain, longChainId ? 64 : 8) +
      intToUintByte(0, 16)
    );
  }
}
