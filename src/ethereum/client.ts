import { AxiosResponse } from 'axios';
import { eth } from '@cypherock/server-wrapper';

export const getTransactionCount = async (
  address: string,
  network = 'main'
) => {
  return eth.wallet
    .getTxnCount({
      address,
      network,
      responseType: 'v2'
    })
    .request()
    .then((res: AxiosResponse) => res.data.count);
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
      contractAddress,
      responseType: 'v2'
    })
    .request()
    .then((res: AxiosResponse) => {
      return res.data.balance;
    });
};

export const getDecimal = async (network = 'main', contractAddress: string) => {
  return eth.wallet
    .getContractDecimal({
      network,
      contractAddress,
      responseType: 'v2'
    })
    .request()
    .then(res => res.data.decimal);
};
