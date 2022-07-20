import { base_decode } from 'near-api-js/lib/utils/serialize';

const generateNearAddress = (xpub: string) => {
  xpub.toUpperCase();
  const dxpub = base_decode(xpub).toString('hex');
  const address = dxpub.substring(92, dxpub.length - 8); // yank pubkey from xpub
  return address;
};

export default generateNearAddress;
