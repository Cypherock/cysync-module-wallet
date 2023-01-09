export { default as BitcoinWallet } from './bitcoinForks';
export { default as EthereumWallet } from './ethereum';
export { default as NearWallet } from './near';
export { default as SolanaWallet } from './solana';
export * from './utils/extenalUtils';
export * from './errors';
export { logLevel } from './utils';

import {
  COINS,
  EthCoinData,
  NearCoinData,
  SolanaAccountTypes,
  SolanaCoinData
} from '@cypherock/communication';
import { AddressDB, TransactionDB } from '@cypherock/database';

import BitcoinWallet from './bitcoinForks';
import EthereumWallet from './ethereum';
import NearWallet from './near';
import SolanaWallet from './solana';

//Add support for ethereum here when implemented
const newWallet = ({
  coinId,
  xpub,
  walletId,
  transactionDB,
  addressDB,
  accountType,
  accountId,
  accountIndex
}: {
  coinId: string;
  xpub: string;
  walletId: string;
  accountType?: string;
  accountIndex: number;
  accountId: string;
  addressDB?: AddressDB;
  transactionDB?: TransactionDB;
}) => {
  const coin = COINS[coinId];

  if (!coin) {
    throw new Error(`Invalid coinId: ${coinId}`);
  }

  if (coin instanceof EthCoinData) {
    return new EthereumWallet(accountIndex, xpub, coin);
  } else if (coin instanceof NearCoinData) {
    return new NearWallet(accountIndex, xpub, coin);
  } else if (coin instanceof SolanaCoinData) {
    return new SolanaWallet(
      accountIndex,
      accountType || SolanaAccountTypes.base,
      xpub,
      coin
    );
  }

  return new BitcoinWallet({
    xpub,
    coinId,
    walletId,
    addressDb: addressDB,
    accountType,
    transactionDb: transactionDB,
    accountId,
    accountIndex
  });
};

export default newWallet;
