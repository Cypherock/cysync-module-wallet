import crypto from 'crypto';

const generateWalletNamesFromXpub = (xpub: string, zpub?: string) => {
  const hash = crypto
    .createHash('sha256')
    .update(xpub)
    .digest('hex')
    .slice(0, 24); // We need to use first 32 characters, but blockcypher allows max of 25

  const allWallets = [];

  const internal = `c${hash}`;
  const external = `r${hash}`;

  allWallets.push(internal);
  allWallets.push(external);

  if (zpub) {
    const segwitHash = crypto
      .createHash('sha256')
      .update(zpub)
      .digest('hex')
      .slice(0, 24); // We need to use first 32 characters, but blockcypher allows max of 25

    allWallets.push(`c${segwitHash}`);
    allWallets.push(`r${segwitHash}`);
  }

  return allWallets;
};

export default generateWalletNamesFromXpub;
