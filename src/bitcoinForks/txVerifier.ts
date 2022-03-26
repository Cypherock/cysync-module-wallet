import { binToHex, hexToBin, instantiateSecp256k1 } from '@bitauth/libauth';
/* tslint:disable-next-line */
const secp256k1 = require('secp256k1');
import crypto from 'crypto';
import { intToUintByte, reverse } from './segwitHelper';
import decodeTxn, { IDecodedTxn } from './txDecoder';

const CONSTANTS = {
  OP_DUP: '76',
  OP_HASH160: 'a9',
  OP_EQUALVERIFY: '88',
  OP_CHECKSIG: 'ac'
};

function sha256(s: string) {
  return crypto.createHash('sha256').update(s, 'hex').digest('hex');
}

function ripemd160(s: string) {
  return crypto.createHash('ripemd160').update(s, 'hex').digest('hex');
}

function decodeScriptSig(scriptSig: string) {
  let processedLen = 0;
  let signation = '';
  let publicKey;

  while (processedLen < scriptSig.length) {
    const signatureLength =
      parseInt(scriptSig.slice(processedLen, processedLen + 2), 16) * 2;
    const isPublicKey = processedLen + signatureLength + 2 >= scriptSig.length;
    if (isPublicKey) {
      publicKey = scriptSig.slice(processedLen + 2).slice(0, signatureLength);
      processedLen += signatureLength + 2;
    } else {
      const sig = scriptSig
        .slice(processedLen + 2)
        .slice(0, signatureLength - 2);
      processedLen += signatureLength + 2;
      signation += sig;
    }
  }

  if (!signation || !publicKey) {
    throw new Error('Error in decoding scriptSig');
  }

  // const DER = signation.slice(0, 2);
  // const len = signation.slice(2, 4);
  // const rTypeInt = signation.slice(4, 6);
  const rLen = parseInt(signation.slice(6, 8), 16) * 2;
  const r = signation.slice(8, 8 + rLen);
  // const sTypeInt = signation.slice(rLen + 8, rLen + 10);
  const sLen = parseInt(signation.slice(rLen + 10, rLen + 12), 16) * 2;
  const s = signation.slice(rLen + 12, 12 + rLen + sLen);
  let signature;

  if (r.startsWith('00')) {
    signature = r.slice(2) + s;
  } else {
    signature = r + s;
  }

  if (signature.length < 128) {
    const remainingLen = 128 - signature.length;
    for (let i = 0; i < remainingLen; i++) {
      signature = '0' + signature;
    }
  }

  return { signature, signation, publicKey };
}

function getScriptFromScriptSig(inputScriptSig: string) {
  const { signature, publicKey } = decodeScriptSig(inputScriptSig);
  //const publicKey = inputScriptSig.slice(inputScriptSig.length - 66);
  //const { address } = bitcoin.payments.p2pkh({
  //pubkey: Buffer.from(publicKey, "hex"),
  //network: litecoinNetwork
  //});

  const sha256Digest = sha256(publicKey);

  const hash160Address = ripemd160(sha256Digest);

  const hexLength = (hash160Address.length / 2).toString(16);
  const hash160AddressWithLen = hexLength + hash160Address;

  const lockScript = `${CONSTANTS.OP_DUP}${CONSTANTS.OP_HASH160}${hash160AddressWithLen}${CONSTANTS.OP_EQUALVERIFY}${CONSTANTS.OP_CHECKSIG}`;
  const lockScriptLen = (lockScript.length / 2).toString(16);
  const lockScriptWithLen = lockScriptLen + lockScript;

  return { signature, publicKey, lockScript: lockScriptWithLen };
}

async function compressedPKtoFullPK(pubkey: string) {
  const prefix = pubkey.slice(0, 2);
  let finalKey = '';

  if (prefix === '02' || prefix === '03') {
    const localSecp256k1 = await instantiateSecp256k1();
    const compressed = hexToBin(pubkey);
    const uncompressed = localSecp256k1.uncompressPublicKey(compressed);

    finalKey = binToHex(uncompressed);
  } else if (prefix === '04') {
    finalKey = pubkey;
  }

  return finalKey;
}

async function verifySignature(
  message: string,
  publicKey: string,
  signature: string
) {
  const fullPk = await compressedPKtoFullPK(publicKey);
  const sigUint = hexToBin(signature);
  const txnUint = hexToBin(message);
  const publicKeyUint = hexToBin(fullPk);

  return secp256k1.ecdsaVerify(sigUint, txnUint, publicKeyUint);
}

async function verifyTxnInput(decoded: IDecodedTxn, index: number) {
  const { signature, lockScript, publicKey } = getScriptFromScriptSig(
    decoded.inputs[index].scriptSig
  );

  let serializedTxn = decoded.network + decoded.rawInputCount;

  for (let i = 0; i < decoded.inputs.length; i++) {
    const input = decoded.inputs[i];
    if (i === index) {
      serializedTxn += input.rawTxHash;
      serializedTxn += input.rawOutputIndex;
      serializedTxn += lockScript;
      serializedTxn += input.sequence;
    } else {
      serializedTxn += input.rawTxHash;
      serializedTxn += input.rawOutputIndex;
      serializedTxn += '00';
      serializedTxn += input.sequence;
    }
  }
  serializedTxn += decoded.rawOutputCount;

  for (const output of decoded.outputs) {
    serializedTxn += output.rawValue;
    serializedTxn += output.scriptLen;
    serializedTxn += output.scriptPubKey;
  }

  serializedTxn += decoded.locktime;
  if (decoded.hashType) {
    serializedTxn += decoded.hashType;
  }

  serializedTxn += '01000000';

  const txnSha256 = sha256(serializedTxn);
  const serializedTxnHash = sha256(txnSha256);

  return await verifySignature(serializedTxnHash, publicKey, signature);
}

async function verifySegwitTxnInput(
  decoded: IDecodedTxn,
  index: number,
  amount: number
) {
  let prevTxId = '';
  let prevSequence = '';
  let outputs = '';

  for (const input of decoded.inputs) {
    prevTxId += input.rawTxHash;
    prevTxId += input.rawOutputIndex;
    prevSequence += input.sequence;
  }

  for (const output of decoded.outputs) {
    outputs += output.rawValue + output.scriptLen + output.scriptPubKey;
  }

  const hashPrevouts = sha256(sha256(prevTxId));
  const hashSequence = sha256(sha256(prevSequence));
  const hashOutputs = sha256(sha256(outputs));

  const outpoint =
    decoded.inputs[index].rawTxHash + decoded.inputs[index].rawOutputIndex;
  const witness = decoded.inputs[index].witness;
  if (!witness) {
    throw new Error('Witness is not present');
  }

  const { lockScript, publicKey, signature } = getScriptFromScriptSig(witness);

  const amountHex = reverse(intToUintByte(amount, 64));
  const sequence = decoded.inputs[index].sequence;

  const hashPreimage =
    decoded.network +
    hashPrevouts +
    hashSequence +
    outpoint +
    lockScript +
    amountHex +
    sequence +
    hashOutputs +
    decoded.locktime +
    '01000000';
  const sigHash = sha256(sha256(hashPreimage));

  return await verifySignature(sigHash, publicKey, signature);
}

export default async function verifyTxn(
  signedTxn: string,
  inputs: Array<{
    value: number;
  }>
) {
  const decodedTxn = decodeTxn(signedTxn);

  if (decodedTxn.inputs.length !== inputs.length) {
    throw new Error('Input length does not match');
  }

  for (let i = 0; i < decodedTxn.inputs.length; i++) {
    let isVerified: boolean;
    if (decodedTxn.inputs[i].isSegwit) {
      isVerified = await verifySegwitTxnInput(decodedTxn, i, inputs[i].value);
    } else {
      isVerified = await verifyTxnInput(decodedTxn, i);
    }

    if (!isVerified) {
      return { isVerified: false, index: i };
    }
  }

  return { isVerified: true, index: -1 };
}
