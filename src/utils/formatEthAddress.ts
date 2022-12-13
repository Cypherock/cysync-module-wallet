import bech32 from 'bech32';
import { utils } from 'ethers';
import uint8ArrayFromHexString from './uint8ArrayFromHexString';

const formatEthAddress = (addr: string) => {
  // Convert from lowercase address to mixed case for easier comparison
  const mixedCaseAddr = utils.getAddress(addr);
  return mixedCaseAddr;
};

export const formatHarmonyAddress = (address: string) => {
  const addressBytes = uint8ArrayFromHexString(address.slice(2));
  return bech32.encode('one', bech32.toWords(addressBytes));
};

export default formatEthAddress;
