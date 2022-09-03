import Common, { Chain } from '@ethereumjs/common';
import { Transaction, TxData } from '@ethereumjs/tx';
import {
  EthCoinData,
  FeatureName,
  isFeatureEnabled
} from '@cypherock/communication';
import BigNumber from 'bignumber.js';
import { utils } from 'ethers';
import * as RLP from 'rlp';
import Web3 from 'web3';
import IWallet from '../interface/wallet';
import verifyTxn from './txVerifier';
import { logger } from '../utils';
import { getBalance, getDecimal, getTransactionCount } from './client';
import { WalletError, WalletErrorType } from '../errors';

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

  constructor(xpub: string, coin: EthCoinData, node = 0) {
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
    logger.verbose('Approximating Txn Fee', { address: this.address });

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
    contractAbbr: string = 'ETH'
  ): Promise<string> {
    logger.info('Generating metadata for', {
      address: this.address,
      contractAddress,
      contractAbbr
    });
    const purposeIndex = '8000002c';
    const coinIndex = this.coin.coinIndex;
    const accountIndex = '80000000';

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
      contract = Buffer.from(contractAbbr, 'utf-8').toString('hex') + '00';
    } else {
      gas = intToUintByte(0, 32);
      contract = Buffer.from(contractAbbr.toUpperCase(), 'utf-8')
        .toString('hex')
        .slice(0, 14)
        .padEnd(16, '0');
    }
    // 8 byte name
    // contract = contract + '0'.repeat(16 - contract.length);

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
      intToUintByte(this.coin.chain, 8)
    );
  }

  // gas price in gwei
  async generateUnsignedTransaction(
    outputAddress: string,
    amount: BigNumber,
    gasPrice: number,
    gasLimit: number,
    chain = 1,
    isSendAll: boolean,
    contractAddress?: string
  ): Promise<{
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
    logger.info('Generating unsignedTxn for', {
      address: this.address,
      outputAddress,
      amount,
      gasPrice,
      gasLimit,
      chain,
      contractAddress
    });

    // Convert from lowercase address to mixed case for easier comparison
    const mixedCaseOutputAddr = utils.getAddress(outputAddress);

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

      const contract = new this.web3.eth.Contract(
        this.minABI,
        contractAddress,
        { from: this.address }
      );

      rawTx = {
        // call from server.
        nonce: await getTransactionCount(this.address, this.network),
        gasPrice: this.web3.utils.toHex(gasPrice * 1000000000),
        gasLimit: this.web3.utils.toHex(gasLimit),
        to: contractAddress,
        value: '0x0',
        data: contract.methods
          .transfer(mixedCaseOutputAddr, totalAmount.toString(10))
          .encodeABI()
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
        nonce: await getTransactionCount(this.address, this.network),
        gasPrice: this.web3.utils.toHex(gasPrice * 1000000000),
        gasLimit: this.web3.utils.toHex(gasLimit),
        to: mixedCaseOutputAddr,
        value: this.web3.utils.toHex(totalAmount.toString(10))
      };
    }
    const transaction = new Transaction(rawTx, {
      common: new Common({ chain: chain === 1 ? Chain.Mainnet : Chain.Ropsten })
    });
    const txHex = transaction.serialize().toString('hex');
    const decoded: any = RLP.decode(Buffer.from(txHex, 'hex'));
    const v = chain;
    // added zero because Buffer.from('1', 'hex') returns an empty buffer
    decoded[6] = Buffer.from('0' + v.toString(16), 'hex');
    logger.info('Calculated amount', { totalAmount });

    return {
      txn: RLP.encode(decoded).toString('hex'),
      fee: totalFee,
      amount: totalAmount,
      inputs: [
        { address: this.address, value: totalAmount.toString(), isMine: true }
      ],
      outputs: [
        {
          address: mixedCaseOutputAddr,
          value: totalAmount.toString(),
          isMine: this.address === mixedCaseOutputAddr
        }
      ]
    };
  }

  async getTotalBalance(contractAddress?: string) {
    // to keep in sync with bitcoin's balance structure in the db
    const bal = {
      balance: await getBalance(this.address, this.network, contractAddress)
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
    let r = rawValues.slice(0, 64);
    let s = rawValues.slice(64, 128);
    while (r.slice(0, 2) === '00') r = r.slice(2);
    while (s.slice(0, 2) === '00') s = s.slice(2);
    const vParity = rawValues.slice(128) === '00' ? 0 : 1;
    const txn: any = RLP.decode(Buffer.from(unsignedTxn, 'hex'));

    // Typescript giving error here without using :any, due to issue in the rlp library. The output is an array of buffers, but the types are defined wrong in the file.
    txn[7] = Buffer.from(r, 'hex');
    txn[8] = Buffer.from(s, 'hex');

    // tslint:disable-next-line: no-bitwise
    const v = 2 * chainId + 35 + vParity;
    txn[6] = Buffer.from(v.toString(16), 'hex');

    return RLP.encode(txn).toString('hex');
  }

  public async verifySignedTxn(signedTxn: string) {
    return verifyTxn(signedTxn, this.address);
  }

  public getDerivationPath(sdkVersion: string, contractAbbr = 'ETH'): string {
    const purposeIndex = '8000002c';
    const coinIndex = this.coin.coinIndex;
    const accountIndex = '80000000';
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

    return (
      purposeIndex +
      coinIndex +
      accountIndex +
      chainIndex +
      addressIndex +
      contract +
      intToUintByte(this.coin.chain, 8)
    );
  }
}
