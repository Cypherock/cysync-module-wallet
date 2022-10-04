import { AxiosResponse } from 'axios';
import { solana } from '@cypherock/server-wrapper';

export const getBalance = async (address: string, network: string) => {
  return solana.wallet
    .getBalance({
      address,
      network
    })
    .request()
    .then((res: AxiosResponse) => res.data.balance);
};

export const getBlockHash = async (network: string) => {
  return solana.transaction
    .getBlockHash({
      network
    })
    .request()
    .then((res: AxiosResponse) => res.data.hash);
};
