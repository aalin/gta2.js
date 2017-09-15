function uint8arrayToString(arr) {
  const len = arr.length;
  let str = '';

  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(arr[i]);
  }

  return str;
}

export class StructReader {
  constructor(struct) {
    this.functions = Object.keys(struct).reduce((arr, key) => {
      const value = struct[key];
      let fn;
      let args = [];

      switch (true) {
        case value instanceof Array:
          fn = `read${value[0]}`;
          args.push(value[1]);
          break;
        case typeof value === 'string':
          fn = `read${value}`;
          break;
        default:
          throw 'Unknown value';
          break;
      }

      arr.push({ key, fn, args });

      return arr;
    }, []);
  }

  read(buffer) {
    return this.functions.reduce((obj, { key, fn, args }) => {
      const fun = buffer[fn];
      if (!fun) {
        console.log(this.functions);
        throw `Invalid function: ${fn}`;
      }
      obj[key] = buffer[fn].apply(buffer, args);
      return obj;
    }, {});
  }
}

const packFn = (acc, x) => (acc << 8) + x;

export function packIntLE(array) {
  return array.reduceRight(packFn, 0) >>> 0;
}

export function packIntBE(array) {
  return array.reduce(packFn, 0) >>> 0;
}

function formatHex(array, length = 1) {
  return Array.prototype.map
    .call(array, i => i.toString(16).padStart(length * 2, '0'))
    .join(' ');
}

function buildTypedArray(numBytes, length) {
  const len = Math.floor(length / numBytes);

  switch (numBytes) {
    case 1:
      return new Uint8Array(len);
    case 2:
      return new Uint16Array(len);
    case 4:
      return new Uint32Array(len);
    default:
      throw `Can't build array with ${numBytes} elements`;
  }
}

const _data = Symbol();
const _pos = Symbol();

export default class BinaryByffer {
  constructor(data) {
    this[_data] = data;
    this[_pos] = 0;
  }

  get length() {
    return this[_data].length;
  }

  get pos() {
    return this[_pos];
  }

  set pos(pos) {
    this[_pos] = Math.max(0, Math.min(pos, this.length));
  }

  setPos(pos) {
    this.pos = pos;
    return this;
  }

  read8() {
    return this._readIntLE(1);
  }
  read16() {
    return this._readIntLE(2);
  }
  read32() {
    return this._readIntLE(4);
  }

  read8LE() {
    return this._readIntLE(1);
  }
  read16LE() {
    return this._readIntLE(2);
  }
  read32LE() {
    return this._readIntLE(4);
  }

  read8BE() {
    return this._readIntBE(1);
  }
  read16BE() {
    return this._readIntBE(2);
  }
  read32BE() {
    return this._readIntBE(4);
  }

  read8arrayLE(len) {
    return this.readArrayLE(1, len);
  }
  read16arrayLE(len) {
    return this.readArrayLE(2, len);
  }
  read32arrayLE(len) {
    return this.readArrayLE(4, len);
  }

  readStructs(count, struct) {
    if (struct instanceof StructReader) {
       // return Array.from({ length: count }, (_, i) => (console.log(i, this.pos, this.length), struct.read(this)));
      return Array.from({ length: count }, (_, i) => struct.read(this));
    }

    return this.readStructs(count, new StructReader(struct));
  }

  readStruct(struct) {
    if (struct instanceof StructReader) {
      return struct.read(this);
    }

    return this.readStruct(new StructReader(struct));
  }

  read8arrayBE(len) {
    return this.readArrayBE(1, len);
  }
  read16arrayBE(len) {
    return this.readArrayBE(2, len);
  }
  read32arrayBE(len) {
    return this.readArrayBE(4, len);
  }

  readString(len) {
    return this._readString(len);
  }

  readArrayLE(numBytes, len) {
    return this.readArray(numBytes, len, packIntLE);
  }

  readArrayBE(numBytes, len) {
    return this.readArray(numBytes, len, packIntBE);
  }

  readArray(numBytes, len, packFn = packIntLE) {
    const bytes = this._readBytes(len);

    if (numBytes === 1) {
      return bytes;
    }

    const result = buildTypedArray(numBytes, len);

    for (let i = 0; i < result.length; i++) {
      const x = i * numBytes;
      result[i] = packFn(bytes.slice(x, x + numBytes));
    }

    return result;
  }

  _readIntLE(numBytes) {
    return packIntLE(this._readBytes(numBytes));
  }

  _readIntBE(numBytes) {
    return packIntBE(this._readBytes(numBytes));
  }

  _readString(numBytes) {
    return uint8arrayToString(this._readBytes(numBytes));
  }

  _peekBytes(numBytes) {
    return this[_data].slice(this[_pos], this[_pos] + numBytes);
  }

  skip(numBytes) {
    this.pos += numBytes;
  }

  eof() {
    return this[_pos] >= this.length;
  }

  _readBytes(numBytes) {
    const pos = this.pos;
    const bytes = this._peekBytes(numBytes);
    this.skip(numBytes);
    return bytes;
  }

  inspect(numBytes = 16) {
    return `[${this.constructor.name} pos=${this.pos} length=${this.length} next=${formatHex(this._peekBytes(numBytes), 1)}]`;
  }
}
