import bech32 from 'bech32';
import * as bip32 from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import b58 from 'bs58check';
import crypto from 'crypto';

// In 2 places, put them in one place
export function intToUintByte(ele: any, radix: number) {
  const val = Number(ele).toString(16);
  const noOfZeroes = radix / 4 - val.length;
  let res = '';
  for (let i = 0; i < noOfZeroes; i += 1) {
    res += '0';
  }
  return res + val;
}

export function convertZpub(zpub: string, isTestNet: boolean) {
  let data = b58.decode(zpub);
  data = data.slice(4);
  if (isTestNet) {
    // Append `xpub`
    data = Buffer.concat([Buffer.from('043587cf', 'hex'), data]);
  } else {
    // Append `tpub`
    data = Buffer.concat([Buffer.from('0488b21e', 'hex'), data]);
  }
  return b58.encode(data);
}

export function getSegwitAddress(
  zpub: string,
  isTestNet: boolean,
  network: any,
  chainIndex: number,
  addressIndex: number
) {
  const data = bip32
    .fromBase58(zpub, network)
    .derive(chainIndex)
    .derive(addressIndex).publicKey;

  const sha256Digest = crypto
    .createHash('sha256')
    .update(data.toString('hex'), 'hex')
    .digest('hex');

  const ripemd160Digest = crypto
    .createHash('ripemd160')
    .update(sha256Digest, 'hex')
    .digest('hex');

  const bech32Words = bech32.toWords(Buffer.from(ripemd160Digest, 'hex'));
  const words = new Uint8Array([0, ...bech32Words]);
  return bech32.encode(isTestNet ? 'tb' : 'bc', Array.from(words));
}

export function reverse(str: string) {
  if (!str) {
    return str;
  }

  const matches = str.match(/[a-fA-F0-9]{2}/g);

  if (matches) {
    return matches.reverse().join('');
  } else {
    return str;
  }
}

export function getScriptKey(address: string, network: any) {
  const key = bitcoin.address.toOutputScript(address, network).toString('hex');
  const len = Math.ceil(key.length / 2);

  return { key, len };
}

export function isScriptSegwit(script: string) {
  return script.startsWith('0014');
}

export function createSegwitTransaction(
  inputs: Array<{ txId: string; vout: number; value: number; address: string }>,
  outputs: Array<{ value: number; address: string }>,
  network: any
) {
  const networkVersion = '02000000';
  let txHash = networkVersion;

  txHash += intToUintByte(inputs.length, 8);

  for (const input of inputs) {
    txHash += reverse(input.txId);
    txHash += reverse(intToUintByte(input.vout, 32));
    txHash += reverse(intToUintByte(input.value, 64));
    const { key, len } = getScriptKey(input.address, network);
    txHash += intToUintByte(len, 8);
    txHash += key;
    txHash += 'ffffffff';
  }

  txHash += intToUintByte(outputs.length, 8);
  for (const output of outputs) {
    txHash += reverse(intToUintByte(output.value, 64));
    const { key, len } = getScriptKey(output.address, network);
    txHash += intToUintByte(len, 8);
    txHash += key;
  }

  txHash += '00000000';
  txHash += '01000000';

  return txHash;
}

export function createSegwitSignedTransaction(
  unsignedTxn: string,
  inputSignatures: string[]
) {
  let len = 0;
  let signedTxn = '';
  let witness = '';
  let isSegwit = false;
  const network = unsignedTxn.slice(len, 8);
  len += network.length;
  signedTxn += network;

  const inputCount = unsignedTxn.slice(len, len + 2);
  len += inputCount.length;

  let inputs = inputCount;
  for (let i = 0; i < parseInt(inputCount, 16); i++) {
    const txHash = unsignedTxn.slice(len, len + 64);
    len += txHash.length;
    inputs += txHash;

    const outputIndex = unsignedTxn.slice(len, len + 8);
    len += outputIndex.length;
    inputs += outputIndex;

    const value = unsignedTxn.slice(len, len + 16);
    len += value.length;

    const scriptLen = unsignedTxn.slice(len, len + 2);
    len += scriptLen.length;

    const scriptPubKey = unsignedTxn.slice(
      len,
      len + parseInt(scriptLen, 16) * 2
    );
    len += scriptPubKey.length;

    if (isScriptSegwit(scriptPubKey)) {
      isSegwit = true;
      inputs += intToUintByte(0, 8);
      witness += '02';
      witness += inputSignatures[i];
    } else {
      witness += '00';
      const sigLen = inputSignatures[i].length / 2;
      inputs += intToUintByte(sigLen, 8);
      inputs += inputSignatures[i];
    }

    const sequence = unsignedTxn.slice(len, len + 8);
    len += sequence.length;
    inputs += sequence;
  }

  const outputCount = unsignedTxn.slice(len, len + 2);
  len += outputCount.length;

  let outputs = outputCount;
  for (let i = 0; i < parseInt(outputCount, 16); i++) {
    const value = unsignedTxn.slice(len, len + 16);
    len += value.length;
    outputs += value;

    const scriptLen = unsignedTxn.slice(len, len + 2);
    len += scriptLen.length;
    outputs += scriptLen;

    const scriptPubKey = unsignedTxn.slice(
      len,
      len + parseInt(scriptLen, 16) * 2
    );
    len += scriptPubKey.length;
    outputs += scriptPubKey;
  }

  if (isSegwit) {
    signedTxn += '00'; // Marker
    signedTxn += '01'; // Flag
    signedTxn += inputs;
    signedTxn += outputs;
    signedTxn += witness;
    signedTxn += '00000000'; // Locktime
  } else {
    signedTxn += inputs;
    signedTxn += outputs;
    signedTxn += '00000000'; // Locktime
    signedTxn += '01000000'; // HashType
  }

  return signedTxn;
}
