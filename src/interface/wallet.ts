export default interface IWallet {
  xpub: string;

  newReceiveAddress: () => Promise<string> | string;

  getTotalBalance: () => Promise<any>;

  setupNewWallet: () => void;

  generateMetaData: (...args: any[]) => any;

  generateUnsignedTransaction: (...args: any[]) => Promise<{ txn: string }>;
}
