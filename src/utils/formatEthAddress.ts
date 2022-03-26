import { utils } from 'ethers';

const formatEthAddress = (addr: string) => {
  // Convert from lowercase address to mixed case for easier comparison
  const mixedCaseAddr = utils.getAddress(addr);
  return mixedCaseAddr;
};

export default formatEthAddress;
