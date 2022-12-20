const uint8ArrayFromHexString = (hexString: string): Uint8Array => {
  //throw error if string is of length 0
  //for odd lengthed string final byte will be prepended with 0
  return Uint8Array.from(
    hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
};

export const toHexString = (byteArray: Uint8Array) => {
  let s = '0x';
  byteArray.forEach(byte => {
    s += ('0' + byte.toString(16)).slice(-2);
  });
  return s;
};

export default uint8ArrayFromHexString;
