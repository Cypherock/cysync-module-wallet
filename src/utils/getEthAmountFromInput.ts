import InputDataDecoder from 'ethereum-input-data-decoder';
import ABI from '../config/abi';
import logger from '../utils/logger';

const inputDataDecoder = new InputDataDecoder(ABI as any);

/**
 * @description
 * To decode the input data and return the amount.
 * Returns 0 if error or not a transfer input.
 */
const getAmountFromInput = (input: string) => {
  let amount = 0;
  try {
    const decoded = inputDataDecoder.decodeData(input);
    if (decoded && decoded.method === 'transfer') {
      amount = Number(decoded.inputs[1]);
    }
  } catch (error) {
    logger.error(error);
  }
  return amount;
};

export default getAmountFromInput;
