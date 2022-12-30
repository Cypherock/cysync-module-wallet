import { EthCoinMap } from '@cypherock/communication';
import { utils } from 'ethers';
import { formatHarmonyAddress } from './formatEthAddress';

const generateEthAddress = (
  xpub: string,
  coinId: string,
  options?: { forceHex: boolean }
) => {
  const address = utils.HDNode.fromExtendedKey(xpub).derivePath(`0/0`).address;
  if (options?.forceHex) return address;
  if (coinId === EthCoinMap.harmony) return formatHarmonyAddress(address);
  return address;
};

export default generateEthAddress;
