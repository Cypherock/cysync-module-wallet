import BigNumber from 'bignumber.js';
import { getTypeHash } from 'eip-712';
import { TypedDataStruct_TypedDataNode_Eip712DataType } from './eip712MsgData.pb';

export const addEIP712TypeFields = (typedData: any) => {
  // Create a deep copy of the input object
  const copy = JSON.parse(JSON.stringify(typedData));
  const types = copy.types;

  const encodeNumber = (
    num: string,
    numBytes: number,
    littleEndian: boolean
  ): Buffer => {
    const byteList: number[] = [];
    let currNum = new BigNumber(num);

    for (let i = 0; i < numBytes; i++) {
      const byte = currNum.mod(256).toNumber();

      if (littleEndian) {
        byteList.push(byte);
      } else {
        byteList.unshift(byte);
      }

      currNum = new BigNumber(
        currNum.dividedBy(256).toFixed(0, BigNumber.ROUND_FLOOR)
      );
    }

    while (byteList.length < numBytes) {
      if (littleEndian) {
        byteList.push(0);
      } else {
        byteList.unshift(0);
      }
    }

    return Buffer.from(byteList);
  };

  const getTypeFromString = (input: string) => {
    //only for primitives
    let result = TypedDataStruct_TypedDataNode_Eip712DataType.UNRECOGNIZED;
    if (input.startsWith('uint')) {
      result = TypedDataStruct_TypedDataNode_Eip712DataType.UINT;
    } else if (input.startsWith('int')) {
      result = TypedDataStruct_TypedDataNode_Eip712DataType.INT;
    } else if (input.startsWith('bytes')) {
      result = TypedDataStruct_TypedDataNode_Eip712DataType.BYTES;
    } else if (input.startsWith('string')) {
      result = TypedDataStruct_TypedDataNode_Eip712DataType.STRING;
    } else if (input.startsWith('bool')) {
      result = TypedDataStruct_TypedDataNode_Eip712DataType.BOOL;
    } else if (input.startsWith('address')) {
      result = TypedDataStruct_TypedDataNode_Eip712DataType.ADDRESS;
    }
    return result;
  };

  const getTypeSizeFromString = (input: string, data: any) => {
    //only for primitives
    let result = 0;
    switch (getTypeFromString(input)) {
      case TypedDataStruct_TypedDataNode_Eip712DataType.UINT:
        result = +input.replace('uint', '') / 8;
        break;
      case TypedDataStruct_TypedDataNode_Eip712DataType.INT:
        result = +input.replace('int', '') / 8;
        break;
      case TypedDataStruct_TypedDataNode_Eip712DataType.ADDRESS:
      case TypedDataStruct_TypedDataNode_Eip712DataType.BYTES:
        result = Buffer.from((data as string).slice(2), 'hex').length;
        break;
      case TypedDataStruct_TypedDataNode_Eip712DataType.STRING:
        result = data.length;
        break;
      case TypedDataStruct_TypedDataNode_Eip712DataType.BOOL:
        result = 1;
        break;
    }
    return result;
  };
  const getDataAsBytesFromString = (input: string, data: any) => {
    //only for primitives
    let result: any;
    switch (getTypeFromString(input)) {
      case TypedDataStruct_TypedDataNode_Eip712DataType.UINT:
      case TypedDataStruct_TypedDataNode_Eip712DataType.INT:
      case TypedDataStruct_TypedDataNode_Eip712DataType.BOOL:
        result = encodeNumber(data, getTypeSizeFromString(input, data), false);
        break;
      case TypedDataStruct_TypedDataNode_Eip712DataType.STRING:
        result = Buffer.from(data);
        break;
      case TypedDataStruct_TypedDataNode_Eip712DataType.ADDRESS:
      case TypedDataStruct_TypedDataNode_Eip712DataType.BYTES:
        result = Buffer.from((data as string).slice(2), 'hex');
        break;
    }
    return result;
  };

  const combineTypeField = (name: string, obj: any, type: string) => {
    const searchType = type.split('[')[0];
    const isArrayType = searchType !== type;
    const fieldType = types[searchType];

    if (fieldType || isArrayType) {
      let children: any[] = [];
      const unsorted: any[] = [];
      for (const key of Object.keys(obj)) {
        let childType = searchType;
        if (!isArrayType)
          childType = fieldType.find((field: any) => field.name === key)?.type;
        if (!childType) continue;
        unsorted.push(combineTypeField(key, obj[key], childType));
      }
      if (!isArrayType) {
        for (const field of fieldType) {
          children.push(unsorted.find(val => field.name === val.name));
        }
      } else {
        children = unsorted;
      }
      return {
        name,
        type: isArrayType
          ? TypedDataStruct_TypedDataNode_Eip712DataType.ARRAY
          : TypedDataStruct_TypedDataNode_Eip712DataType.STRUCT,
        size: children.length,
        structName: type,
        typeHash: !isArrayType ? getTypeHash(typedData, searchType) : undefined,
        children
      };
    } else {
      return {
        name,
        type: getTypeFromString(type),
        size: getTypeSizeFromString(type, obj),
        data: getDataAsBytesFromString(type, obj),
        structName: type
      };
    }
  };

  const formattedData = {
    message: combineTypeField('message', copy.message, copy.primaryType),
    domain: combineTypeField('domain', copy.domain, 'EIP712Domain')
  };

  return formattedData;
};
