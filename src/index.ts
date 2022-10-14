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
  SolanaCoinData
} from '@cypherock/communication';
import { AddressDB, TransactionDB } from '@cypherock/database';

import BitcoinWallet from './bitcoinForks';
import EthereumWallet from './ethereum';
import NearWallet from './near';
import SolanaWallet from './solana';

//Add support for ethereum here when implemented
const newWallet = ({
  coinType,
  xpub,
  walletId,
  transactionDB,
  zpub,
  addressDB
}: {
  coinType: string;
  xpub: string;
  walletId: string;
  zpub?: string;
  addressDB?: AddressDB;
  transactionDB?: TransactionDB;
}) => {
  const coin = COINS[coinType.toLowerCase()];

  if (!coin) {
    throw new Error(`Invalid coinType: ${coinType}`);
  }

  if (coin instanceof EthCoinData) {
    return new EthereumWallet(xpub, coin);
  } else if (coin instanceof NearCoinData) {
    return new NearWallet(xpub, coin);
  } else if (coin instanceof SolanaCoinData) {
    return new SolanaWallet(xpub, coin);
  }

  return new BitcoinWallet({
    xpub,
    coinType,
    walletId,
    zpub,
    addressDb: addressDB,
    transactionDb: transactionDB
  });
};

export default newWallet;
