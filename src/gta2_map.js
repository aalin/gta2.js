import { downloadAsset } from './utils';
import loadChunks from './load_chunks';
import { packIntLE } from './binary_buffer';
import { vec2, vec3, mat2d } from 'gl-matrix';
import BinaryBuffer, { StructReader } from './binary_buffer';
import Model from './model';
import IteratorGenerator from './iterator_generator';
import Counter from './counter';

let ITERATIONS = 0;

const INT_SIZE = 4;

const ColInfo = new StructReader({
  height: '8LE',
  offset: '8LE',
  pad: '16LE',
  blockd: ['32arrayLE', 8 * INT_SIZE]
});

const BlockInfo = new StructReader({
  left: "16LE",
  right: "16LE",
  top: "16LE",
  bottom: "16LE",
  lid: "16LE",
  arrows: "8LE",
  slopeType: "8LE"
});

function* createXYiterator(count, xadd = 0, yadd = 0) {
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      yield [x + xadd, y + yadd];
    }
  }
}

function* subdivide(size, partSize) {
  const numParts = size / partSize;

  for (let y = 0; y < numParts; y++) {
    for (let x = 0; x < numParts; x++) {
      yield createXYiterator(partSize, y * partSize, x * partSize);
    }
  }
}

function buildLid(slopeType) {
  switch (true) {
    case slopeType > 1 && slopeType <= 8:
      return constructLid(slopeType - 1, 2);
    case slopeType > 9 && slopeType <= 40:
      return constructLid(slopeType - 9, 8);
    case slopeType > 41 && slopeType <= 44:
      return constructLid(slopeType - 41, 1);
    default:
      return constructLid(0, 0);
  }
}

function Vertex(position, texcoord = [0, 0]) {
  this.position = position;
  this.texcoord = texcoord;
}

const TWW = 1.0 / 32.0;
const TAA = 0.0;
const TXX = TAA + TWW;

const TEXCOORDS = [
  [TAA, TAA],
  [TXX, TAA],
  [TXX, TXX],
  [TAA, TXX],
];

function getFace(offset, face, quad) {
  const texture = (face & 0x3ff) >>> 0;

  if (!texture) {
    return [];
  }

  const textureOffset = vec2.create();

  vec2.add(textureOffset, [0, 0], [
    (Math.floor(texture % 32) * 64) / 2048.0,
    (Math.floor(texture / 32) * 64) / 2048.0,
  ]);

  const vertexes = Array.from({ length: 4 }, (_, i) => {
    const position = vec3.create();
    const texcoord = vec2.create();
    vec3.add(position, position, quad[i]);
    vec2.add(texcoord, texcoord, TEXCOORDS[i]);

    return new Vertex(position, texcoord);
  });

  const flip = (face & 0x2000) >>> 0;
  const rotation = ((face >> 14) >>> 0) * 90;

  const rotationMat = mat2d.create();
  mat2d.rotate(rotationMat, rotationMat, -rotation * Math.PI / 180.0);

  const flipMat = mat2d.create();
  mat2d.scale(flipMat, flipMat, [1.0, -1.0]);

  vertexes.forEach((vertex) => {
    vec2.add(vertex.texcoord, vertex.texcoord, [-TWW / 2, -TWW / 2]);
    vec2.transformMat2d(vertex.texcoord, vertex.texcoord, rotationMat);
    vec2.add(vertex.texcoord, vertex.texcoord, [TWW / 2, TWW / 2]);

    if (flip) {
      vec2.transformMat2d(vertex.texcoord, vertex.texcoord, flipMat);
    }

    vec2.add(vertex.texcoord, vertex.texcoord, textureOffset);
    vec3.add(vertex.position, vertex.position, offset);
  });

  const res = [
    vertexes[0],
    vertexes[1],
    vertexes[2],
    vertexes[0],
    vertexes[2],
    vertexes[3],
  ];

  return res;
}

function getBlock(block, offset) {
  const slopeType = (block.slopeType >> 2) >>> 0;
  const lid = buildLid(slopeType);

  //const lid = quad(0, 0, 0);
  return flatten([
    getFace(offset, block.lid, lid),
    getFace(offset, block.bottom, [
      [0, 0, -1],
      [1, 0, -1],
      lid[1],
      lid[0]
    ]),
    getFace(offset, block.top, [
      [0, 1, -1],
      [1, 1, -1],
      lid[2],
      lid[3]
    ]),
    getFace(offset, block.left, [
      [0, 0, -1],
      [0, 1, -1],
      lid[3],
      lid[0]
    ]),
    getFace(offset, block.right, [
      [1, 1, -1],
      [1, 0, -1],
      lid[1],
      lid[2]
    ]),
  ]);
}

function constructLid(slope, numLevels) {
  if(slope == 0) {
    return [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0]
    ];
  }

  const height = 1.0 / numLevels;
  const level = slope % numLevels;
  const low = height * level - height * numLevels;

  let lid = [
    [0, 0, low],
    [1, 0, low],
    [1, 1, low],
    [0, 1, low],
  ];

  // this is weird, everything seems to be mirrored and upside down... :/
  switch (slope / numLevels) {
    case 0: // up
      vec3.add(lid[2], lid[2], [0, 0, height]);
      vec3.add(lid[3], lid[3], [0, 0, height]);
      break;
    case 1: // down
      vec3.add(lid[0], lid[0], [0, 0, height]);
      vec3.add(lid[1], lid[1], [0, 0, height]);
      break;
    case 2: // right
      vec3.add(lid[0], lid[0], [0, 0, height]);
      vec3.add(lid[3], lid[3], [0, 0, height]);
      break;
    case 3: // left
      vec3.add(lid[1], lid[1], [0, 0, height]);
      vec3.add(lid[2], lid[2], [0, 0, height]);
      break;
  }

  return lid;
}

function eachSlice(array, size, callback) {
  for (var i = 0, l = array.length; i < l; i += size){
    callback.call(array, array.slice(i, i + size))
  }
}

function* parseMap(data) {
  for (let chunk of loadChunks(data, 'GBMP', 500)) {
    const { type, size, buffer } = chunk;

    switch (type) {
      case 'DMAP':
        yield { base: buffer.read32arrayLE(256 * 256 * INT_SIZE) };

        const columnWords = buffer.read32LE();

        yield { columnWords };

        console.log('column words', columnWords);
        yield { columns: buffer.read8arrayLE(columnWords * 4) };
        console.log("POSITION", buffer.pos);

        const numBlocks = buffer.read32LE();

        yield { numBlocks };

        console.log("num columns:", columnWords);
        console.log("num blocks:", numBlocks);

        yield { blocks: buffer.readStructs(numBlocks, BlockInfo) };

        break;
      default:
        console.log(`Got type ${type}, skipping ${size}`);
        buffer.skip(size);
        break;
    }
  }
}

let ID = 0;
let lastOffset = 0;

function flatten(a) {
  if (a instanceof Array) {
    return a.reduce((acc, e) => acc.concat(flatten(e)), []);
  }

  return a;
}

function quad(x, y, z) {
  return [
    [x, y, z],
    [x, y+1, z],
    [x+1, y+1, z],
    [x+1, y, z],
  ];
}

class ArrayWriter {
  constructor(array) {
    this._array = array;
    this._index = 0;
  }

  get pos() {
    return this._index;
  }

  get eof() {
    return this._index >= this._array.length;
  }

  reset() {
    this._index = 0;
  }

  write(data) {
    for (let i = 0; i < data.length; i++) {
      this._array[this._index++] = data[i];
    }
  }

  get array() {
    return new this._array.constructor(this._array.slice(0, this._index));
  }
}

function* loadVertexes(parts) {
  const size = parts.length;
  let count = 0;

  const positions = new ArrayWriter(new Float32Array(256 * 256 * 3 * 12));
  const texcoords = new ArrayWriter(new Float32Array(256 * 256 * 2 * 12));

  for (let divider of subdivide(256, 32)) {
    positions.reset();
    texcoords.reset();

    for (let col of divider) {
      const [x, y] = col;
      const column = parts[y][x];

      for (let z = 0; z < column.length; z++) {
        // for (let z = column.length - 1; z >= 0; z--) {
        if (positions.eof) {
          break;
        }

        const block = column[z];

        if (block === undefined) {
          continue;
        }

        const v = getBlock(block, [x, y, z]);

        v.forEach((vs) => {
          positions.write(vs.position);
          texcoords.write(vs.texcoord);
        })

      }

      // yield { progress: count++ * 256, max: 256 * 256 * 8 };
    }

    yield { progress: count++, max: 256 * 256, positions: positions.array, texcoords: texcoords.array };

    /*
    if (count > 64) { return; }
    */
  }
}

function* loadParts(attributes) {
  const colData = new BinaryBuffer(attributes.columns);

  for (let y = 0; y < 256; y++) {
    const part = [];

    yield { progress: y, max: 256 };

    for (let x = 0; x < 256; x++) {
      part[x] = [];

      const columnIndex = attributes.base[y * 256 + x];

      colData.setPos(columnIndex * 4);
      const colInfo = colData.readStruct(ColInfo);

      // const height = attributes.columns[columnIndex] & 0xff;
      // const offset = ((attributes.columns[columnIndex] & 0xff00) >> 8) >>> 0;
      const height = colInfo.height;
      const offset = colInfo.offset;

      for (var z = 0; z < height; z++) {
        if (z >= offset) {
          // const blockIndex = attributes.columns[columnIndex + z - offset];
          const block = attributes.blocks[colInfo.blockd[z - offset]];

          if (block) {
            part[x][z] = block;
          }
        }
      }

    }
      yield { progress: y, max: 256, result: part };
  }
}


export default
class GTA2Map {
  constructor(models) {
    this.models = models;
  }

  draw(gl, shader, matrices, style = null) {
    shader.use();
    gl.uniformMatrix4fv(shader.uniform('uPMatrix'), false, matrices.p);
    gl.uniformMatrix4fv(shader.uniform('uVMatrix'), false, matrices.v);
    gl.uniformMatrix4fv(shader.uniform('uMMatrix'), false, matrices.m);

    if (style) {
      const texture = style.textures[0];

      if (texture) {
        gl.uniform1i(shader.uniform('uTexture'), texture.index);
      }
    }

    this.models.forEach((model) => {
      model.draw(shader);
    });
  }
}

GTA2Map.load = function* load(gl, filename, getState) {
  let data = null;

  const { blobStore, style } = getState();
  console.log(blobStore);

  for (let download of downloadAsset(filename, blobStore)) {
    if (download.data) {
      data = download.data;
      break;
    }

    yield Object.assign(download, { text: `Downloading ${filename}` });
  }

  const attributes = {};

  for (let part of parseMap(data)) {
    Object.assign(attributes, part);
    yield { progress: 0, max: 100, text: 'Parsing map' };
  }

  const parts = [];
  const counter = new Counter();

  for (let part of loadParts(attributes)) {
    if (part.result) {
      parts.push(part.result);
    }

    if (counter.update) {
      yield { progress: part.progress, max: part.max, text: 'Decompressing map' };
    }
  }

  const models = [];
  counter.reset(10);

  for (let part of loadVertexes(parts)) {
    if (part.positions && part.positions.length) {
      const model = new Model(gl, gl.TRIANGLES);

      console.log('creating model, length:', part.positions.length);
      model.addBuffer('aVertexPosition', part.positions, 3);
      model.addBuffer('aTexCoord', part.texcoords, 2);
      models.push(model);
    }

    if (part.progress && counter.update()) {
      yield { progress: part.progress, max: part.max, text: `Creating map models ${models.length}` };
    }
  }

  yield { result: { models } };
}
