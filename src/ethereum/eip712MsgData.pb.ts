/* eslint-disable */
/* tslint-disable */
import * as _m0 from 'protobufjs/minimal';

export const protobufPackage = '';

export interface SimpleMessage {
  luckyNumber: number;
  more: SimpleMessage[];
}

export interface LinkedList {
  value: number;
  next: LinkedList | undefined;
}

export interface KAryTree {
  value: number;
  children: KAryTree[];
}

export interface TypedDataStruct {
  domain: TypedDataStruct_TypedDataNode | undefined;
  message: TypedDataStruct_TypedDataNode | undefined;
}

export interface TypedDataStruct_TypedDataNode {
  name: string;
  type: TypedDataStruct_TypedDataNode_Eip712DataType;
  size: number;
  structName: string;
  data: Uint8Array;
  typeHash: Uint8Array;
  children: TypedDataStruct_TypedDataNode[];
}

export enum TypedDataStruct_TypedDataNode_Eip712DataType {
  UINT = 1,
  INT = 2,
  BYTES = 3,
  STRING = 4,
  BOOL = 5,
  ADDRESS = 6,
  ARRAY = 7,
  STRUCT = 8,
  UNRECOGNIZED = -1
}

export function typedDataStruct_TypedDataNode_Eip712DataTypeFromJSON(
  object: any
): TypedDataStruct_TypedDataNode_Eip712DataType {
  switch (object) {
    case 1:
    case 'UINT':
      return TypedDataStruct_TypedDataNode_Eip712DataType.UINT;
    case 2:
    case 'INT':
      return TypedDataStruct_TypedDataNode_Eip712DataType.INT;
    case 3:
    case 'BYTES':
      return TypedDataStruct_TypedDataNode_Eip712DataType.BYTES;
    case 4:
    case 'STRING':
      return TypedDataStruct_TypedDataNode_Eip712DataType.STRING;
    case 5:
    case 'BOOL':
      return TypedDataStruct_TypedDataNode_Eip712DataType.BOOL;
    case 6:
    case 'ADDRESS':
      return TypedDataStruct_TypedDataNode_Eip712DataType.ADDRESS;
    case 7:
    case 'ARRAY':
      return TypedDataStruct_TypedDataNode_Eip712DataType.ARRAY;
    case 8:
    case 'STRUCT':
      return TypedDataStruct_TypedDataNode_Eip712DataType.STRUCT;
    case -1:
    case 'UNRECOGNIZED':
    default:
      return TypedDataStruct_TypedDataNode_Eip712DataType.UNRECOGNIZED;
  }
}

export function typedDataStruct_TypedDataNode_Eip712DataTypeToJSON(
  object: TypedDataStruct_TypedDataNode_Eip712DataType
): string {
  switch (object) {
    case TypedDataStruct_TypedDataNode_Eip712DataType.UINT:
      return 'UINT';
    case TypedDataStruct_TypedDataNode_Eip712DataType.INT:
      return 'INT';
    case TypedDataStruct_TypedDataNode_Eip712DataType.BYTES:
      return 'BYTES';
    case TypedDataStruct_TypedDataNode_Eip712DataType.STRING:
      return 'STRING';
    case TypedDataStruct_TypedDataNode_Eip712DataType.BOOL:
      return 'BOOL';
    case TypedDataStruct_TypedDataNode_Eip712DataType.ADDRESS:
      return 'ADDRESS';
    case TypedDataStruct_TypedDataNode_Eip712DataType.ARRAY:
      return 'ARRAY';
    case TypedDataStruct_TypedDataNode_Eip712DataType.STRUCT:
      return 'STRUCT';
    case TypedDataStruct_TypedDataNode_Eip712DataType.UNRECOGNIZED:
    default:
      return 'UNRECOGNIZED';
  }
}

export interface MessageData {
  messageType: MessageData_MessageType;
  dataBytes: Uint8Array;
  eip712data: TypedDataStruct | undefined;
}

export enum MessageData_MessageType {
  ETH_SIGN = 1,
  PERSONAL_SIGN = 2,
  SIGN_TYPED_DATA = 3,
  UNRECOGNIZED = -1
}

export function messageData_MessageTypeFromJSON(
  object: any
): MessageData_MessageType {
  switch (object) {
    case 1:
    case 'ETH_SIGN':
      return MessageData_MessageType.ETH_SIGN;
    case 2:
    case 'PERSONAL_SIGN':
      return MessageData_MessageType.PERSONAL_SIGN;
    case 3:
    case 'SIGN_TYPED_DATA':
      return MessageData_MessageType.SIGN_TYPED_DATA;
    case -1:
    case 'UNRECOGNIZED':
    default:
      return MessageData_MessageType.UNRECOGNIZED;
  }
}

export function messageData_MessageTypeToJSON(
  object: MessageData_MessageType
): string {
  switch (object) {
    case MessageData_MessageType.ETH_SIGN:
      return 'ETH_SIGN';
    case MessageData_MessageType.PERSONAL_SIGN:
      return 'PERSONAL_SIGN';
    case MessageData_MessageType.SIGN_TYPED_DATA:
      return 'SIGN_TYPED_DATA';
    case MessageData_MessageType.UNRECOGNIZED:
    default:
      return 'UNRECOGNIZED';
  }
}

function createBaseSimpleMessage(): SimpleMessage {
  return { luckyNumber: 0, more: [] };
}

export const SimpleMessage = {
  encode(
    message: SimpleMessage,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.luckyNumber !== 0) {
      writer.uint32(8).int32(message.luckyNumber);
    }
    for (const v of message.more) {
      SimpleMessage.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SimpleMessage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSimpleMessage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.luckyNumber = reader.int32();
          break;
        case 2:
          message.more.push(SimpleMessage.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SimpleMessage {
    return {
      luckyNumber: isSet(object.luckyNumber) ? Number(object.luckyNumber) : 0,
      more: Array.isArray(object?.more)
        ? object.more.map((e: any) => SimpleMessage.fromJSON(e))
        : []
    };
  },

  toJSON(message: SimpleMessage): unknown {
    const obj: any = {};
    message.luckyNumber !== undefined &&
      (obj.luckyNumber = Math.round(message.luckyNumber));
    if (message.more) {
      obj.more = message.more.map(e =>
        e ? SimpleMessage.toJSON(e) : undefined
      );
    } else {
      obj.more = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SimpleMessage>, I>>(
    object: I
  ): SimpleMessage {
    const message = createBaseSimpleMessage();
    message.luckyNumber = object.luckyNumber ?? 0;
    message.more = object.more?.map(e => SimpleMessage.fromPartial(e)) || [];
    return message;
  }
};

function createBaseLinkedList(): LinkedList {
  return { value: 0, next: undefined };
}

export const LinkedList = {
  encode(
    message: LinkedList,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.value !== 0) {
      writer.uint32(8).int32(message.value);
    }
    if (message.next !== undefined) {
      LinkedList.encode(message.next, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LinkedList {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLinkedList();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.value = reader.int32();
          break;
        case 2:
          message.next = LinkedList.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): LinkedList {
    return {
      value: isSet(object.value) ? Number(object.value) : 0,
      next: isSet(object.next) ? LinkedList.fromJSON(object.next) : undefined
    };
  },

  toJSON(message: LinkedList): unknown {
    const obj: any = {};
    message.value !== undefined && (obj.value = Math.round(message.value));
    message.next !== undefined &&
      (obj.next = message.next ? LinkedList.toJSON(message.next) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<LinkedList>, I>>(
    object: I
  ): LinkedList {
    const message = createBaseLinkedList();
    message.value = object.value ?? 0;
    message.next =
      object.next !== undefined && object.next !== null
        ? LinkedList.fromPartial(object.next)
        : undefined;
    return message;
  }
};

function createBaseKAryTree(): KAryTree {
  return { value: 0, children: [] };
}

export const KAryTree = {
  encode(
    message: KAryTree,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.value !== 0) {
      writer.uint32(8).int32(message.value);
    }
    for (const v of message.children) {
      KAryTree.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): KAryTree {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseKAryTree();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.value = reader.int32();
          break;
        case 3:
          message.children.push(KAryTree.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): KAryTree {
    return {
      value: isSet(object.value) ? Number(object.value) : 0,
      children: Array.isArray(object?.children)
        ? object.children.map((e: any) => KAryTree.fromJSON(e))
        : []
    };
  },

  toJSON(message: KAryTree): unknown {
    const obj: any = {};
    message.value !== undefined && (obj.value = Math.round(message.value));
    if (message.children) {
      obj.children = message.children.map(e =>
        e ? KAryTree.toJSON(e) : undefined
      );
    } else {
      obj.children = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<KAryTree>, I>>(object: I): KAryTree {
    const message = createBaseKAryTree();
    message.value = object.value ?? 0;
    message.children = object.children?.map(e => KAryTree.fromPartial(e)) || [];
    return message;
  }
};

function createBaseTypedDataStruct(): TypedDataStruct {
  return { domain: undefined, message: undefined };
}

export const TypedDataStruct = {
  encode(
    message: TypedDataStruct,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.domain !== undefined) {
      TypedDataStruct_TypedDataNode.encode(
        message.domain,
        writer.uint32(10).fork()
      ).ldelim();
    }
    if (message.message !== undefined) {
      TypedDataStruct_TypedDataNode.encode(
        message.message,
        writer.uint32(18).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TypedDataStruct {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTypedDataStruct();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.domain = TypedDataStruct_TypedDataNode.decode(
            reader,
            reader.uint32()
          );
          break;
        case 2:
          message.message = TypedDataStruct_TypedDataNode.decode(
            reader,
            reader.uint32()
          );
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TypedDataStruct {
    return {
      domain: isSet(object.domain)
        ? TypedDataStruct_TypedDataNode.fromJSON(object.domain)
        : undefined,
      message: isSet(object.message)
        ? TypedDataStruct_TypedDataNode.fromJSON(object.message)
        : undefined
    };
  },

  toJSON(message: TypedDataStruct): unknown {
    const obj: any = {};
    message.domain !== undefined &&
      (obj.domain = message.domain
        ? TypedDataStruct_TypedDataNode.toJSON(message.domain)
        : undefined);
    message.message !== undefined &&
      (obj.message = message.message
        ? TypedDataStruct_TypedDataNode.toJSON(message.message)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<TypedDataStruct>, I>>(
    object: I
  ): TypedDataStruct {
    const message = createBaseTypedDataStruct();
    message.domain =
      object.domain !== undefined && object.domain !== null
        ? TypedDataStruct_TypedDataNode.fromPartial(object.domain)
        : undefined;
    message.message =
      object.message !== undefined && object.message !== null
        ? TypedDataStruct_TypedDataNode.fromPartial(object.message)
        : undefined;
    return message;
  }
};

function createBaseTypedDataStruct_TypedDataNode(): TypedDataStruct_TypedDataNode {
  return {
    name: '',
    type: 1,
    size: 0,
    structName: '',
    data: new Uint8Array(),
    typeHash: new Uint8Array(),
    children: []
  };
}

export const TypedDataStruct_TypedDataNode = {
  encode(
    message: TypedDataStruct_TypedDataNode,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.name !== '') {
      writer.uint32(10).string(message.name);
    }
    writer.uint32(16).int32(message.type);
    if (message.size !== 0) {
      writer.uint32(24).uint32(message.size);
    }
    if (message.structName !== '') {
      writer.uint32(34).string(message.structName);
    }
    if (message.data.length !== 0) {
      writer.uint32(42).bytes(message.data);
    }
    if (message.typeHash.length !== 0) {
      writer.uint32(50).bytes(message.typeHash);
    }
    for (const v of message.children) {
      TypedDataStruct_TypedDataNode.encode(
        v!,
        writer.uint32(58).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): TypedDataStruct_TypedDataNode {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTypedDataStruct_TypedDataNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.name = reader.string();
          break;
        case 2:
          message.type = reader.int32() as any;
          break;
        case 3:
          message.size = reader.uint32();
          break;
        case 4:
          message.structName = reader.string();
          break;
        case 5:
          message.data = reader.bytes();
          break;
        case 6:
          message.typeHash = reader.bytes();
          break;
        case 7:
          message.children.push(
            TypedDataStruct_TypedDataNode.decode(reader, reader.uint32())
          );
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): TypedDataStruct_TypedDataNode {
    return {
      name: isSet(object.name) ? String(object.name) : '',
      type: isSet(object.type)
        ? typedDataStruct_TypedDataNode_Eip712DataTypeFromJSON(object.type)
        : 1,
      size: isSet(object.size) ? Number(object.size) : 0,
      structName: isSet(object.structName) ? String(object.structName) : '',
      data: isSet(object.data)
        ? bytesFromBase64(object.data)
        : new Uint8Array(),
      typeHash: isSet(object.typeHash)
        ? bytesFromBase64(object.typeHash)
        : new Uint8Array(),
      children: Array.isArray(object?.children)
        ? object.children.map((e: any) =>
            TypedDataStruct_TypedDataNode.fromJSON(e)
          )
        : []
    };
  },

  toJSON(message: TypedDataStruct_TypedDataNode): unknown {
    const obj: any = {};
    message.name !== undefined && (obj.name = message.name);
    message.type !== undefined &&
      (obj.type = typedDataStruct_TypedDataNode_Eip712DataTypeToJSON(
        message.type
      ));
    message.size !== undefined && (obj.size = Math.round(message.size));
    message.structName !== undefined && (obj.structName = message.structName);
    message.data !== undefined &&
      (obj.data = base64FromBytes(
        message.data !== undefined ? message.data : new Uint8Array()
      ));
    message.typeHash !== undefined &&
      (obj.typeHash = base64FromBytes(
        message.typeHash !== undefined ? message.typeHash : new Uint8Array()
      ));
    if (message.children) {
      obj.children = message.children.map(e =>
        e ? TypedDataStruct_TypedDataNode.toJSON(e) : undefined
      );
    } else {
      obj.children = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<TypedDataStruct_TypedDataNode>, I>>(
    object: I
  ): TypedDataStruct_TypedDataNode {
    const message = createBaseTypedDataStruct_TypedDataNode();
    message.name = object.name ?? '';
    message.type = object.type ?? 1;
    message.size = object.size ?? 0;
    message.structName = object.structName ?? '';
    message.data = object.data ?? new Uint8Array();
    message.typeHash = object.typeHash ?? new Uint8Array();
    message.children =
      object.children?.map(e => TypedDataStruct_TypedDataNode.fromPartial(e)) ||
      [];
    return message;
  }
};

function createBaseMessageData(): MessageData {
  return { messageType: 1, dataBytes: new Uint8Array(), eip712data: undefined };
}

export const MessageData = {
  encode(
    message: MessageData,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    writer.uint32(8).int32(message.messageType);
    if (message.dataBytes.length !== 0) {
      writer.uint32(18).bytes(message.dataBytes);
    }
    if (message.eip712data !== undefined) {
      TypedDataStruct.encode(
        message.eip712data,
        writer.uint32(26).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): MessageData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMessageData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.messageType = reader.int32() as any;
          break;
        case 2:
          message.dataBytes = reader.bytes();
          break;
        case 3:
          message.eip712data = TypedDataStruct.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): MessageData {
    return {
      messageType: isSet(object.messageType)
        ? messageData_MessageTypeFromJSON(object.messageType)
        : 1,
      dataBytes: isSet(object.dataBytes)
        ? bytesFromBase64(object.dataBytes)
        : new Uint8Array(),
      eip712data: isSet(object.eip712data)
        ? TypedDataStruct.fromJSON(object.eip712data)
        : undefined
    };
  },

  toJSON(message: MessageData): unknown {
    const obj: any = {};
    message.messageType !== undefined &&
      (obj.messageType = messageData_MessageTypeToJSON(message.messageType));
    message.dataBytes !== undefined &&
      (obj.dataBytes = base64FromBytes(
        message.dataBytes !== undefined ? message.dataBytes : new Uint8Array()
      ));
    message.eip712data !== undefined &&
      (obj.eip712data = message.eip712data
        ? TypedDataStruct.toJSON(message.eip712data)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<MessageData>, I>>(
    object: I
  ): MessageData {
    const message = createBaseMessageData();
    message.messageType = object.messageType ?? 1;
    message.dataBytes = object.dataBytes ?? new Uint8Array();
    message.eip712data =
      object.eip712data !== undefined && object.eip712data !== null
        ? TypedDataStruct.fromPartial(object.eip712data)
        : undefined;
    return message;
  }
};

declare var self: any | undefined;
declare var window: any | undefined;
declare var global: any | undefined;
var tsProtoGlobalThis: any = (() => {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  if (typeof self !== 'undefined') {
    return self;
  }
  if (typeof window !== 'undefined') {
    return window;
  }
  if (typeof global !== 'undefined') {
    return global;
  }
  throw 'Unable to locate global object';
})();

function bytesFromBase64(b64: string): Uint8Array {
  if (tsProtoGlobalThis.Buffer) {
    return Uint8Array.from(tsProtoGlobalThis.Buffer.from(b64, 'base64'));
  } else {
    const bin = tsProtoGlobalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}

function base64FromBytes(arr: Uint8Array): string {
  if (tsProtoGlobalThis.Buffer) {
    return tsProtoGlobalThis.Buffer.from(arr).toString('base64');
  } else {
    const bin: string[] = [];
    arr.forEach(byte => {
      bin.push(String.fromCharCode(byte));
    });
    return tsProtoGlobalThis.btoa(bin.join(''));
  }
}

type Builtin =
  | Date
  | Function
  | Uint8Array
  | string
  | number
  | boolean
  | undefined;

export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<DeepPartial<U>>
  : T extends {}
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin
  ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & {
      [K in Exclude<keyof I, KeysOfUnion<P>>]: never;
    };

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
