import { AxiosResponse } from 'axios';
import { near } from '@cypherock/server-wrapper';

export const getBalance = async (
  address: string,
  network = 'testnet',
) => {
  return near.wallet
    .getBalance({
      address,
      network,
    })
    .request()
    .then((res: AxiosResponse) => res.data);
};

export const getKeys = async (
  address: string,
  network = 'testnet',
) => {
  return near.wallet
    .getKeys({
      address,
      network,
    })
    .request()
    .then((res: AxiosResponse) => res.data);
};

export const getAccounts = async (
  address: string,
  network = 'testnet',
) => {
  return near.wallet
    .getAccounts({
      address,
      network,
    })
    .request()
    .then((res: AxiosResponse) => res.data);
};

export const getBlockHash = async (
  network = 'testnet',
) => {
  return near.transaction
    .getBlockHash({network})
    .request()
    .then((res: AxiosResponse) => res.data);
};