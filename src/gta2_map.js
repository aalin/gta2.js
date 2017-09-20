import { downloadAsset } from './utils';
import loadChunks from './load_chunks';
import { packIntLE } from './binary_buffer';
import { vec2, vec3, mat2d } from 'gl-matrix';
import BinaryBuffer, { StructReader } from './binary_buffer';
import Model from './model';
import IteratorGenerator from './iterator_generator';

const MAP_SIZE = 256;
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

function fixedPoint(x) {
  return (((x & 0xff80) >> 7) >>> 0) % 256 + (x & 0x7f) / 128.0;
}

const Light = new StructReader({
  argb: '32LE',
  x: '16LE',
  y: '16LE',
  z: '16LE',
  radius: '16LE',
  intensity: '8LE',
  shape: '8LE',
  on_time: '8LE',
  off_time: '8LE',
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
    case 62:
    case 63:
      return null;
    case slopeType >= 1 && slopeType <= 8:
      return constructLid(slopeType - 1, 2);
    case slopeType >= 9 && slopeType <= 40:
      return constructLid(slopeType - 9, 8);
    case slopeType >= 41 && slopeType <= 44:
      return constructLid(slopeType - 41, 1);
    case slopeType >= 45 && slopeType <= 48:
      return constructLid(slopeType - 45, 0, true);
    default:
      return constructLid(0, 0);
  }
}

function Vertex(position, texcoord = [0, 0]) {
  this.position = position;
  this.texcoord = texcoord;
}

const TPP = 1.0 / 4096.0;
const TWW = 1.0 / 32.0;
const TZZ = 0.0;
const TAA = TZZ + TPP;
const TXX = TZZ + TWW - TPP;

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

  getVertexes() {
    return this.vertexes;
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
    ];
  }

  getVertexes() {
    return this.triangles.reduce((a, tri) => a.concat(tri.vertexes), []);
  }
}

class Face {
  constructor(face) {
    this.texture = (face & 0x3ff) >>> 0;
    this.flat = !!(face & 0x1000);
    this.flip = !!(face & 0x2000);
    this.rotation = ((face >> 14) >>> 0) * 90;
  }
}

function getFace(offset, face, verts, texcoords = TEXCOORDS) {
  if (face.texture === 0) {
    return null;
  }

  if (face.texture === 0x3ff) {
    return null;
    face.texture = 0;
  }

  if (face.texture > 992) {
    return null;
  }

  if (face.hide) {
    return null;
  }

  const textureOffset = vec2.create();

  vec2.add(textureOffset, [0, 0], [
    (Math.floor(face.texture % 32) * 64) / 2048.0,
    (Math.floor(face.texture / 32) * 64) / 2048.0,
  ]);

  const vertexes = Array.from(verts, (v, i) => {
    const position = vec3.create();
    const texcoord = vec2.create();
    vec3.add(position, position, v);
    vec2.add(texcoord, texcoord, texcoords[i]);

    return new Vertex(position, texcoord);
  });

  const rotationMat = mat2d.create();

  mat2d.rotate(rotationMat, rotationMat, -face.rotation * Math.PI / 180.0);

  const flipMat = mat2d.create();

  if (face.flip) {
    mat2d.scale(flipMat, flipMat, [-1.0, -1.0]);
  } else {
    mat2d.scale(flipMat, flipMat, [1.0, -1.0]);
  }

  vertexes.forEach((vertex, i) => {
    vec2.add(vertex.texcoord, vertex.texcoord, [-TWW / 2, -TWW / 2]);
    vec2.transformMat2d(vertex.texcoord, vertex.texcoord, flipMat);
    vec2.transformMat2d(vertex.texcoord, vertex.texcoord, rotationMat);
    vec2.add(vertex.texcoord, vertex.texcoord, [TWW / 2, TWW / 2]);
    vec2.add(vertex.texcoord, vertex.texcoord, textureOffset);
    vec3.add(vertex.position, vertex.position, offset);
  });

  if (vertexes.length === 4) {
    return new Quad(vertexes);
  } else {
    return new Triangle(vertexes);
  }
}

function setLidVerts(lid, indexes, texcoordIndexes = indexes) {
  const verts = indexes.map(idx => lid[idx]);
  const texcoords = texcoordIndexes.map(idx => TEXCOORDS[idx]);
  return { verts, texcoords };
}

const TRIANGLE_DIRECTION_OFFSETS = [0, 1, 3, 2];

const TRIANGLE_DIRECTION_INDEXES = [
  [0, 1, 2],
  [0, 1, 3],
  [1, 2, 3],
  [0, 2, 3],
];

function buildTriangleBlock(offset, faces, lid, direction) {
  const result = [];

  const faces2 = [faces.top, faces.right, faces.bottom, faces.left];
  const visibleCornerIndex = faces2.findIndex(face => face.texture !== 0);

  const indexes = TRIANGLE_DIRECTION_INDEXES[direction];
  let lidVerts = setLidVerts(lid, indexes);

  result.push(
    getFace(offset, faces.lid, lidVerts.verts, lidVerts.texcoords)
  );

  if (visibleCornerIndex === -1) {
    return result;
  }

  const face = faces2[visibleCornerIndex];
  const offset2 = TRIANGLE_DIRECTION_OFFSETS[direction];

  const a = (offset2 + 0) % lid.length;
  const b = (offset2 + 2) % lid.length;

  let wallVerts = [
    lid[a].slice(0, 2).concat([-1]),
    lid[b].slice(0, 2).concat([-1]),
    lid[b],
    lid[a],
  ]

  if ((offset2 % 2) === 0) {
    wallVerts = wallVerts.reverse();
  }

  result.push(
    getFace(offset, face, wallVerts)
  );

  return result;
}

function buildSquareBlock(offset, faces, lid) {
  const result = [];

  let topPos = [
    [1, 1, -1],
    [0, 1, -1],
    lid[3],
    lid[2],
  ];

  let bottomPos = [
    [0, 0, -1],
    [1, 0, -1],
    lid[1],
    lid[0],
  ];

  let leftPos = [
    [0, 1, -1],
    [0, 0, -1],
    lid[0],
    lid[3],
  ];

  let rightPos = [
    [1, 0, -1],
    [1, 1, -1],
    lid[2],
    lid[1],
  ];

  if (faces.top.flat && !faces.bottom.flat && faces.bottom.texture !== 0) {
    bottomPos = topPos;
    faces.top.texture = 0;
    faces.bottom.flat = true;
    faces.bottom.flip = !faces.bottom.flip;
  }

  if (faces.bottom.flat && !faces.top.flat && faces.top.texture !== 0) {
    topPos = bottomPos;
    faces.bottom.texture = 0;
    faces.top.flat = true;
    faces.top.flip = !faces.top.flip;
  }

  result.push(getFace(offset, faces.bottom, bottomPos));
  result.push(getFace(offset, faces.top, topPos));

  if (faces.right.flat && !faces.left.flat && faces.left.texture !== 0) {
    leftPos = rightPos;
    faces.right.texture = 0;
    faces.left.flat = true;
    faces.left.flip = !faces.left.flip;
  }

  if (faces.left.flat && !faces.right.flat && faces.right.texture !== 0) {
    rightPos = leftPos;
    faces.left.texture = 0;
    faces.right.flat = true;
    faces.right.flip = !faces.right.flip;
  }

  result.push(getFace(offset, faces.left, leftPos));
  result.push(getFace(offset, faces.right, rightPos));

  result.push(
    getFace(offset, faces.lid, lid)
  );

  return result;
}

function getBlock(block, offset) {
  const groundType = (block.slopeType && 0b11) >>> 0;
  const slopeType = (block.slopeType >> 2) >>> 0;
  const lid = buildLid(slopeType);

  const faces = {
    top: new Face(block.top),
    bottom: new Face(block.bottom),
    right: new Face(block.right),
    left: new Face(block.left),
    lid: new Face(block.lid)
  };

  const diagonal = slopeType >= 45 && slopeType <= 48;

  const quads = diagonal
    ? buildTriangleBlock(offset, faces, lid, (slopeType - 45) % 4)
    : buildSquareBlock(offset, faces, lid);

  return flatten(quads.filter(quad => !!quad).map(quad => quad.getVertexes()));
}

function constructLid(slope, numLevels, diagonal = false) {
  if (slope === 0 && numLevels === 0) {
    return [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ];
  }

  if (numLevels === 0 && diagonal !== false) {
    return [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ];
  }

  const height = numLevels > 0 ? 1.0 / numLevels : 1;
  const level = slope % numLevels;
  const low = height * level - height * numLevels;

  const direction = Math.floor(slope / numLevels);

  let lid = [
    [0, 0, low],
    [1, 0, low],
    [1, 1, low],
    [0, 1, low],
  ];

  switch (direction) {
    case 0: // up
      lid[2][2] += height;
      lid[3][2] += height;
      break;
    case 1: // down
      lid[0][2] += height;
      lid[1][2] += height;
      break;
    case 2: // right
      lid[3][2] += height;
      lid[0][2] += height;
      break;
    case 3: // left
      lid[1][2] += height;
      lid[2][2] += height;
      break;
  }

    /*
  if (diagonal) {
    switch (direction) {
      case 0:
        array.splice(0, i);
        break;
      case 1:
        array.splice(1, i);
        break;
      case 2:
        array.splice(2, i);
        break;
      case 3:
        array.splice(3, i);
        break;
    }
  }
    */

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

        yield { columns: buffer.read8arrayLE(columnWords * 4) };

        const numBlocks = buffer.read32LE();

        yield { numBlocks };

        yield { blocks: buffer.readStructs(numBlocks, BlockInfo) };

        break;
      case 'LGHT':
        const lightSize = 16;
        const lights = buffer.readStructs(size / lightSize, Light).map((light) => {
          light.x = fixedPoint(light.x);
          light.y = fixedPoint(light.y);
          light.z = fixedPoint(light.z);
          light.radius = fixedPoint(light.radius);
          return light;
        });
        console.log(lights);
      default:
        //console.log(`Got type ${type}, skipping ${size}`);
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
  const shadelevels = new ArrayWriter(new Float32Array(MAP_SIZE * MAP_SIZE * 3));

  for (let divider of subdivide(MAP_SIZE, 32)) {
    positions.reset();
    texcoords.reset();
    shadelevels.reset();

    for (let col of divider) {
      const [x, y] = col;
      const column = parts[y][x];

      for (let z = 0; z < column.length; z++) {
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
          // shadelevels.write(vs.shadelevel);
        });
      }
    }

    yield {
      progress: count++,
      max: 64,
      positions: positions.array,
      texcoords: texcoords.array,
      shadelevels: shadelevels.array
    };
  }
}

function* loadParts(attributes) {
  const colData = new BinaryBuffer(attributes.columns);

  for (let y = 0; y < MAP_SIZE; y++) {
    const part = Array.from({ length: MAP_SIZE });

    yield { progress: y, max: MAP_SIZE };

    for (let x = 0; x < MAP_SIZE; x++) {

      const columnIndex = attributes.base[(255 - y) * MAP_SIZE + x] * 4;

      colData.setPos(columnIndex);

      const colInfo = colData.readStruct(ColInfo);

      part[x] = Array.from({ length: 8 });

      for (var z = colInfo.offset; z < colInfo.height; z++) {
        const blockIndex = colInfo.blockd[z - colInfo.offset];
        const block = attributes.blocks[blockIndex];

        if (block) {
          part[x][z] = block;
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

  draw(gl, shader, matrices, playerPosition, style = null) {
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

    const square = Math.sqrt(this.models.length);
    const mul = 256 / square;
    const [px, py] = [
      Math.round(playerPosition[0] / mul),
      Math.round(playerPosition[1] / mul),
    ];

    this.models.forEach((model, i) => {
      const x = Math.round(Math.floor((i % square) * mul) + mul / 2) / mul;
      const y = Math.round(Math.floor(i / square) * mul + mul / 2) / mul;
      const distance = Math.sqrt((px - x) ** 2 + (py - y) ** 2);

      if (distance <= 2.0) {
        model.draw(shader);
      }
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
        models.push(
          new Model(gl, gl.TRIANGLES)
            .addBuffer('aVertexPosition', part.positions, 3)
            .addBuffer('aTexCoord', part.texcoords, 2)
          //.addBuffer('aShadeLevel', part.shadelevels, 1)
        );
      }

      if (part.progress) {
        yield progress(part.progress, part.max, `Creating map models (${models.length})`);
      }
    }

    yield done(new GTA2Map(models));
  }
}
