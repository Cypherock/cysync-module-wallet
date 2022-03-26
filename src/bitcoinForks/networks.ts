const litecoin = {
  messagePrefix: '\x19Litecoin Signed Message:\n',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4
  },
  pubKeyHash: 0x30,
  scriptHash: 0x32,
  wif: 0xb0
};

const dash = {
  messagePrefix: '\x19Dashcoin Signed Message:\n',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4
  },
  pubKeyHash: 0x4c,
  scriptHash: 0x10,
  wif: 0xcc
};

// @ts-ignore
const dogecoin = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bip32: {
    public: 0x02facafd,
    private: 0x02fac398
  },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e
};

export default {
  litecoin,
  dogecoin,
  dash
};
