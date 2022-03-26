import { reverse } from './segwitHelper';

export interface IDecodedInput {
  rawTxHash: string;
  txHash: string;
  rawOutputIndex: string;
  outputIndex: number;
  scriptLen: string;
  scriptSig: string;
  sequence: string;
  witness?: string;
  isSegwit: boolean;
}

export interface IDecodedOutput {
  rawValue: string;
  value: number;
  scriptLen: string;
  scriptPubKey: string;
}

export interface IDecodedTxn {
  isSegwit: boolean;
  network: string;
  marker?: string;
  flag?: string;
  rawInputCount: string;
  inputs: IDecodedInput[];
  rawOutputCount: string;
  outputs: IDecodedOutput[];
  locktime: string;
  hashType?: string;
}

function decodeInput(
  unsignedTxn: string,
  length: number
): { input: IDecodedInput; len: number } {
  let len = length;

  const rawTxHash = unsignedTxn.slice(len, len + 64);
  const txHash = reverse(rawTxHash);
  len += txHash.length;

  const rawOutputIndex = unsignedTxn.slice(len, len + 8);
  const outputIndex = parseInt(reverse(rawOutputIndex), 16);
  len += rawOutputIndex.length;

  const scriptLen = unsignedTxn.slice(len, len + 2);
  len += scriptLen.length;

  const scriptSig = unsignedTxn.slice(len, len + parseInt(scriptLen, 16) * 2);
  len += scriptSig.length;

  const sequence = unsignedTxn.slice(len, len + 8);
  len += sequence.length;

  return {
    input: {
      rawTxHash,
      txHash,
      rawOutputIndex,
      outputIndex,
      scriptLen,
      scriptSig,
      sequence,
      isSegwit: scriptLen === '00'
    },
    len
  };
}

function decodeOutput(unsignedTxn: string, length: number) {
  let len = length;
  const rawValue = unsignedTxn.slice(len, len + 16);
  const value = parseInt(reverse(rawValue), 16);
  len += rawValue.length;

  const scriptLen = unsignedTxn.slice(len, len + 2);
  len += scriptLen.length;

  const scriptPubKey = unsignedTxn.slice(
    len,
    len + parseInt(scriptLen, 16) * 2
  );
  len += scriptPubKey.length;

  return {
    output: { rawValue, value, scriptLen, scriptPubKey },
    len
  };
}

export default function decodeTxn(signedTxn: string): IDecodedTxn {
  let len = 0;
  const network = signedTxn.slice(len, 8);
  len += network.length;

  const isSegwit = signedTxn.slice(len, len + 2) === '00';

  let marker;
  let flag;
  if (isSegwit) {
    marker = signedTxn.slice(len, len + 2);
    len += marker.length;

    flag = signedTxn.slice(len, len + 2);
    len += flag.length;
  }

  const inputCount = signedTxn.slice(len, len + 2);
  len += inputCount.length;

  const inputs: IDecodedInput[] = [];
  for (let i = 0; i < parseInt(inputCount, 16); i++) {
    const decodedInput = decodeInput(signedTxn, len);
    len = decodedInput.len;
    inputs.push(decodedInput.input);
  }

  const outputCount = signedTxn.slice(len, len + 2);
  len += outputCount.length;

  const outputs: IDecodedOutput[] = [];
  for (let i = 0; i < parseInt(outputCount, 16); i++) {
    const decodedOut = decodeOutput(signedTxn, len);
    len = decodedOut.len;
    outputs.push(decodedOut.output);
  }

  if (isSegwit) {
    for (const input of inputs) {
      const witnessLen = signedTxn.slice(len, len + 2);
      len += witnessLen.length;

      if (witnessLen !== '00') {
        const witnessFirst2 = signedTxn.slice(len, len + 2);
        len += witnessFirst2.length;
        let wit = witnessFirst2;

        if (witnessFirst2 === '48') {
          wit += signedTxn.slice(len, len + 212);
        } else {
          wit += signedTxn.slice(len, len + 210);
        }

        input.witness = wit;
        input.isSegwit = true;
        len += wit.length - witnessFirst2.length;
      } else {
        input.isSegwit = false;
      }
    }
  }

  const locktime = signedTxn.slice(len, len + 8);
  len += locktime.length;

  let hashType;
  if (!isSegwit) {
    hashType = signedTxn.slice(len, len + 8);
    len += hashType.length;
  }

  return {
    isSegwit,
    network,
    marker,
    flag,
    rawInputCount: inputCount,
    inputs,
    rawOutputCount: outputCount,
    outputs,
    locktime,
    hashType
  };
}
