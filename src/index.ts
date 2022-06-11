export { default as BitcoinWallet } from './bitcoinForks';
export { default as EthereumWallet } from './ethereum';
export { default as NearWallet } from './near';
export * from './utils/extenalUtils';
export * from './errors';
export { logLevel } from './utils';

import { AddressDB } from '@cypherock/database';
import { COINS, EthCoinData, NearCoinData } from '@cypherock/communication';

import BitcoinWallet from './bitcoinForks';
import EthereumWallet from './ethereum';
import NearWallet from './near';

//Add support for ethereum here when implemented
const newWallet = ({
  coinType,
  xpub,
  walletId,
  zpub,
  addressDB
}: {
  coinType: string;
  xpub: string;
  walletId: string;
  zpub?: string;
  addressDB?: AddressDB;
}) => {
  const coin = COINS[coinType.toLowerCase()];

  if (!coin) {
    throw new Error(`Invalid coinType: ${coinType}`);
  }

  if (coin instanceof EthCoinData) {
    return new EthereumWallet(xpub, coin);
  }else if (coin instanceof NearCoinData){
    return new NearWallet(xpub, coin);
  }

  return new BitcoinWallet(xpub, coinType, walletId, zpub, addressDB);
};

export default newWallet;
