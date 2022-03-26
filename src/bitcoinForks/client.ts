import { bitcoin as bitcoinServer } from '@cypherock/server-wrapper';

export const uploadNewWallet = (
  coinType: string,
  name: string,
  addresses: string[]
) => {
  return bitcoinServer.wallet.addWallet({
    coinType,
    walletName: name,
    addresses
  });
};

export const uploadMoreAddresses = (
  coinType: string,
  name: string,
  addresses: string[]
) => {
  return bitcoinServer.wallet.addAddresses({
    coinType,
    walletName: name,
    addresses
  });
};
