import { AxiosResponse } from 'axios';
import { eth } from '@cypherock/server-wrapper';

export const getTransactionCount = async (
  address: string,
  network = 'main'
) => {
  return eth.wallet
    .getTxnCount({
      address,
      network
    })
    .then((res: AxiosResponse) => res.data);
};

export const getBalance = async (
  address: string,
  network = 'main',
  contractAddress?: string
) => {
  return eth.wallet
    .getBalance({
      address,
      network,
      contractAddress
    })
    .then((res: AxiosResponse) => res.data);
};

export const getDecimal = async (network = 'main', contractAddress: string) => {
  return eth.wallet
    .getContractDecimal({
      network,
      contractAddress
    })
    .then(res => res.data);
};
