import { utils } from 'ethers';
import { formatHarmonyAddress } from './formatEthAddress';

const generateEthAddress = (
  xpub: string,
  coinType: string = 'eth',
  options?: { forceHex: boolean }
) => {
  const address = utils.HDNode.fromExtendedKey(xpub).derivePath(`0/0`).address;
  if (options?.forceHex) return address;
  if (coinType === 'one') return formatHarmonyAddress(address);
  return address;
};

export default generateEthAddress;
