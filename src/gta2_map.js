import { downloadAsset } from './utils';
import loadChunks from './load_chunks';
import { packIntLE } from './binary_buffer';
import { vec2, vec3, mat2d } from 'gl-matrix';
import BinaryBuffer, { StructReader } from './binary_buffer';
import Model from './model';
import IteratorGenerator from './iterator_generator';

const MAP_SIZE = 256;

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
      yield createXYiterator(partSize, x * partSize, y * partSize);
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

class Triangle {
  constructor(vertexes) {
    this.vertexes = vertexes;
  }
}

class Quad {
  constructor(vertexes) {
    this.triangles = [
      new Triangle([
        vertexes[0],
        vertexes[1],
        vertexes[2]
      ]),
      new Triangle([
        vertexes[0],
        vertexes[2],
        vertexes[3]
      ])
    ]
  }

  getVertexes() {
    return this.triangles.reduce((a, tri) => a.concat(tri.vertexes), []);
  }
}

class Face {
  constructor(face) {
    this.texture = face & 0x3ff;
    this.flip = !!(face & 0x1000);
    this.flat = !!(face & 0x2000);
    this.rotation = ((face >> 14) >>> 0) * 90;
  }
}

function getFace(offset, face, quad) {
  if (face.texture === 0) {
    return null;
  }

  if (face.texture === 1023) {
    face.texture = 0;
  }

  if (face.flat) {
    // face.texture = 0;
  }

  const textureOffset = vec2.create();

  vec2.add(textureOffset, [0, 0], [
    (Math.floor(face.texture % 32) * 64) / 2048.0,
    (Math.floor(face.texture / 32) * 64) / 2048.0,
  ]);

  const vertexes = Array.from({ length: 4 }, (_, i) => {
    const position = vec3.create();
    const texcoord = vec2.create();
    vec3.add(position, position, quad[i]);
    vec2.add(texcoord, texcoord, TEXCOORDS[i]);

    return new Vertex(position, texcoord);
  });

  const rotationMat = mat2d.create();
  mat2d.rotate(rotationMat, rotationMat, -face.rotation * Math.PI / 180.0);

  const flipMat = mat2d.create();
  mat2d.scale(flipMat, flipMat, [1.0, -1.0]);

  vertexes.forEach((vertex, i) => {
    vec2.add(vertex.texcoord, vertex.texcoord, [-TWW / 2, -TWW / 2]);
    vec2.transformMat2d(vertex.texcoord, vertex.texcoord, rotationMat);
    vec2.add(vertex.texcoord, vertex.texcoord, [TWW / 2, TWW / 2]);

    if (face.flip) {
      vec2.transformMat2d(vertex.texcoord, vertex.texcoord, flipMat);
    }

    vec2.add(vertex.texcoord, vertex.texcoord, textureOffset);

    /*
    if (isDown) {
      vec2.add(vertex.texcoord, [0, 0], TEXCOORDS[i]);
    }
    */

    vec3.add(vertex.position, vertex.position, offset);
  });

  return new Quad(vertexes);
}

function getBlock(block, offset) {
  const slopeType = (block.slopeType >> 2) >>> 0;
  const lid = buildLid(slopeType);

  let faces = [
    block.bottom,
    block.right,
    block.top,
    block.left,
    block.lid
  ].map(face => new Face(face));

  let quads = [
    getFace(offset, faces[0], [
      [0, 0, 0],
      [1, 0, 0],
      lid[1],
      lid[0],
    ]),
    getFace(offset, faces[1], [
      [1, 1, 0],
      [1, 0, 0],
      lid[1],
      lid[2]
    ]),
    getFace(offset, faces[2], [
      [0, 1, 0],
      [1, 1, 0],
      lid[2],
      lid[3],
    ]),
    getFace(offset, faces[3], [
      [0, 0, 0],
      [0, 1, 0],
      lid[3],
      lid[0],
    ]),
    getFace(offset, faces[4], lid),
  ];


  function replaceFlatness(index1, index2) {
    if (faces[index1].flat && !faces[index2].flat && faces[index2].texture) {
      quads[index1] = null;
    }
    /*
    if (faces[index1].flat && !faces[index2].flat && faces[index2].texture) {
      if (quads[index1] && quads[index2]) {
        quads[index1].setPositionsFrom(quads[index2]);
        quads[index2] = null;
      }
    }
    */
  }

  /*
  replaceFlatness(2, 0);
  replaceFlatness(0, 2);
  replaceFlatness(1, 3);
  replaceFlatness(3, 1);
  */

  return flatten(quads.filter(quad => !!quad).map(quad => quad.getVertexes()));
}

function constructLid(slope, numLevels) {
  if(slope == 0) {
    return [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1]
    ];
  }

  const height = 1.0 / numLevels;
  const level = slope % numLevels;
  const low = 1.0 + height * level - height * numLevels;

  let lid = [
    [0, 0, low],
    [1, 0, low],
    [1, 1, low],
    [0, 1, low],
  ];

  // this is weird, everything seems to be mirrored and upside down... :/
  switch (slope / numLevels) {
    case 0: // up
      vec3.add(lid[0], lid[0], [0, 0, height]);
      vec3.add(lid[1], lid[1], [0, 0, height]);
      break;
    case 1: // down
      vec3.add(lid[2], lid[2], [0, 0, height]);
      vec3.add(lid[3], lid[3], [0, 0, height]);
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
        yield { base: buffer.read32arrayLE(MAP_SIZE * MAP_SIZE * INT_SIZE) };

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

  const positions = new ArrayWriter(new Float32Array(MAP_SIZE * MAP_SIZE * 3 * 20));
  const texcoords = new ArrayWriter(new Float32Array(MAP_SIZE * MAP_SIZE * 2 * 20));

  for (let divider of subdivide(MAP_SIZE, 32)) {
    positions.reset();
    texcoords.reset();

    for (let col of divider) {
      const [x, y] = col;
      const column = parts[y][x];

      for (let z = 0; z < column.length; z++) {
        // for (let z = column.length - 1; z >= 0; z--) {
        if (positions.eof) {
          alert('eof');
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
        });
      }

      // yield { progress: count++ * MAP_SIZE, max: MAP_SIZE * MAP_SIZE * 8 };
    }

    yield { progress: count++, max: 64, positions: positions.array, texcoords: texcoords.array };
  }
}

function* loadParts(attributes) {
  const colData = new BinaryBuffer(attributes.columns);

  for (let y = 0; y < MAP_SIZE; y++) {
    const part = Array.from({ length: MAP_SIZE });

    yield { progress: y, max: MAP_SIZE };

    for (let x = 0; x < MAP_SIZE; x++) {

      const columnIndex = attributes.base[y * MAP_SIZE + x] * 4;

      colData.setPos(columnIndex);

      const colInfo = colData.readStruct(ColInfo);

      part[x] = Array.from({ length: 8 });

      for (var z = colInfo.offset; z < colInfo.height; z++) {
        const blockIndex = colInfo.blockd[z - colInfo.offset];
        const block = attributes.blocks[blockIndex];

        if (block) {
          part[x][z - colInfo.offset] = block;
        } else {
          console.error('no block found at', x, z, blockIndex);
        }
      }
    }

    yield { progress: y, max: MAP_SIZE, result: part };
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

GTA2Map.load = function load(gl, filename) {
  return function* (progress, done) {
    let data = null;

    for (let download of downloadAsset(filename)) {
      if (download.data) {
        data = download.data;
        break;
      }

      yield progress(download.progress, download.max || 1, `Downloading ${filename}`);
    }

    const attributes = {};

    for (let part of parseMap(data)) {
      Object.assign(attributes, part);
      yield progress(0, 100, 'Parsing map');
    }

    const parts = [];

    for (let part of loadParts(attributes)) {
      if (part.result) {
        parts.push(part.result);
      }

      yield progress(part.progress, part.max, 'Decompressing map');
    }

    const models = [];

    for (let part of loadVertexes(parts)) {
      if (part.positions && part.positions.length) {
        const model = new Model(gl, gl.TRIANGLES);

        console.log('creating model, length:', part.positions.length);
        model.addBuffer('aVertexPosition', part.positions, 3);
        model.addBuffer('aTexCoord', part.texcoords, 2);
        models.push(model);
      }

      if (part.progress) {
        yield progress(part.progress, part.max, `Creating map models (${models.length})`);
      }
    }

    yield done(new GTA2Map(models));
  }
}
