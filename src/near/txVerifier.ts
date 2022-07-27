import { SignedTransaction } from 'near-api-js/lib/transaction';
import { key_pair } from 'near-api-js/lib/utils';

export default function verifyTxn(
  signedTxn: string,
  publicKeyString: string
): boolean {
  const signedTransactionObj = SignedTransaction.decode(
    Buffer.from(signedTxn, 'hex')
  );
  const publicKey = key_pair.PublicKey.from(publicKeyString);
  return publicKey.verify(
    signedTransactionObj.transaction.encode(),
    signedTransactionObj.signature.data
  );
}
