import { Transaction } from '@solana/web3.js';

export default function verifyTxn(signedTxn: string): boolean {
  const signedTransaction = Transaction.from(Buffer.from(signedTxn, 'hex'));
  return signedTransaction.verifySignatures();
}
