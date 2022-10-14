import { base_decode, base_encode } from 'near-api-js/lib/utils/serialize';

const generateSolanaAddress = (xpub: string) => {
  const dxpub = base_decode(xpub).toString('hex');
  const address = dxpub.substring(92, dxpub.length - 8); // yank pubkey from xpub
  return base_encode(Buffer.from(address, 'hex'));
};

export default generateSolanaAddress;
