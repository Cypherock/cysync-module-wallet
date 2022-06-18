export default function verifyTxn(signedTxn:string):boolean{
  return signedTxn.length > 0;
}