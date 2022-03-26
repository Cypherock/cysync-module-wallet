import { utils } from 'ethers';

const generateEthAddress = (xpub: string) => {
  const address = utils.HDNode.fromExtendedKey(xpub).derivePath(`0/0`).address;
  return address;
};

export default generateEthAddress;
