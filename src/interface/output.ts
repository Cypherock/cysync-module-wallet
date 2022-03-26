import BigNumber from 'bignumber.js';

export default interface Output {
  address: string;
  value?: BigNumber;
}
