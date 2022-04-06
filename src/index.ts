export { default as BitcoinWallet } from './bitcoinForks';
export { default as EthereumWallet } from './ethereum';
export * from './utils/extenalUtils';
export * from './errors';
export { logLevel } from './utils';

import { COINS, EthCoinData } from '@cypherock/communication';

import BitcoinWallet from './bitcoinForks';
import EthereumWallet from './ethereum';

//Add support for ethereum here when implemented
const newWallet = ({
  coinType,
  xpub,
  zpub,
  addressDbUtil
}: {
  coinType: string;
  xpub: string;
  zpub?: string;
  addressDbUtil?: any;
}) => {
  const coin = COINS[coinType.toLowerCase()];

  if (!coin) {
    throw new Error(`Invalid coinType: ${coinType}`);
  }

  if (coin instanceof EthCoinData) {
    return new EthereumWallet(xpub, coin);
  }

  return new BitcoinWallet(xpub, coinType, zpub, addressDbUtil);
};

export default newWallet;
