import { TransactionFactory } from '@ethereumjs/tx';

import formatEthAddress from '../utils/formatEthAddress';

export default function verifyTxn(signedTxn: string, address: string) {
  const decodedTxn = TransactionFactory.fromSerializedData(
    Buffer.from(signedTxn, 'hex')
  );

  // This is to convert lowercase address to mixed case
  const senderAddress = formatEthAddress(
    decodedTxn.getSenderAddress().toString()
  );

  // Check if signature is valid
  const isVerified = decodedTxn.verifySignature();

  // Check if the sender is same
  const isSameSender = senderAddress === address;

  return isVerified && isSameSender;
}
