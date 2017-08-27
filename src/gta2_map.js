import { downloadAsset } from './utils';
import loadChunks from './load_chunks';
import { packIntLE } from './binary_buffer';
import { vec3 } from 'gl-matrix';
import BinaryBuffer, { StructReader } from './binary_buffer';
import Model from './model';

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

function Vertex(position, texcoords) {
  this.position = position;
  this.texcoords = texcoords;
}

class Block {
  constructor(block, column, offset) {
    this.block = block;
    this.offset = offset;
    this.column = column;
  }

  getFaces() {
    const slopeType = (block.slopeType >> 2) >>> 0;
    const lid = buildLid(slopeType);
    const block = this.block;

    return [
      getFace(block.lid, lid),
      getFace(block.bottom, [
        [0, 0, -1],
        [1, 0, -1],
        lid[1],
        lid[0]
      ]),
      getFace(block.top, [
        [0, 1, -1],
        [1, 1, -1],
        lid[2],
        lid[3]
      ]),
      getFace(block.left, [
        [0, 0, -1],
        [0, 1, -1],
        lid[3],
        lid[0]
      ]),
      getFace(block.right, [
        [1, 1, -1],
        [1, 0, -1],
        lid[1],
        lid[2]
      ])
    ].filter(x => !!x);
  }

  getFace(face, quad) {
    const texture = (face & 0x3ff) >>> 0;

    if (!texture) {
      return;
    }

    const vertices = Array.from({ length: 4 }, () => new Vertex());
    vertices[0].position = quad[0];
    vertices[1].position = quad[1];
    vertices[2].position = quad[2];
    vertices[3].position = quad[3];
    vertices[0].texcoord = [0, 0];
    vertices[1].texcoord = [1, 0];
    vertices[2].texcoord = [1, 1];
    vertices[3].texcoord = [0, 1];

    const flip = (face & 0x2000) >>> 0;

    if (flip) {
      vertices.forEach(v => {
        vec2.scale(v.texcoord, v.texcoord, [-1, 1]);
      });
    }

    vertices.forEach(v => {
      vec2.scale(v.texcoord, v.texcoord, [1,-1]);
    });

    const rotation = ((face >> 14) >>> 0) * 90;

    vertices.forEach(v => {
      //vec2.translate(v.texcoord, v.texcoord, [-0.5, -0.5, 0]);
      // vec2.rotateZ(v.texcoord, v.texcoord, [-0.5, -0.5, 0]);
      //vec2.rotate(v.texcoord, v.texcoord, [-0.5, -0.5, 0]);
    });

    vertices.forEach(v => {
      vec2.add(v.position, this.offset);
    });

    return [
      vertices[0],
      vertices[1],
      vertices[2],
      vertices[0],
      vertices[2],
      vertices[3]
    ];
  }
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

        yield { columns: buffer.read32arrayLE(columnWords) };

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

function loadCell(x, y, attributes, colData) {
  const offsetIndex = y * 256 + x;
  const offset = attributes.base[offsetIndex];

  if (offset === undefined) {
    console.error(`Could not find offset at index ${offsetIndex}`);
    return;
  }

  if (offset > attributes.columns.length) {
    console.error(`Offset is out of bounds (${offset} > ${attributes.columns.length})`);
    return;
  }

  if (offset >= colData.length) {
    return;
  }

  colData.setPos(offset).inspect();
  const column = colData.readStruct(ColInfo);

  const blocks = [];

  for (let z = 0; z < 8; z++) {
    if (z < column.height - column.offset) {
      const block = loadBlock(x, y, z, attributes, column);

      if (block) {
        blocks.push(block);
      }
    }
  }

  return blocks;
}

function loadBlock(x, y, z, attributes, column) {
  const blockIndex = column.blockd[z];

  const height = column.height - column.offset;
  // console.log(blockIndex);

  if (blockIndex === undefined) {
    console.error("blockIndex is undefined", x, y, z, column.blockd);
    throw "blockIndex is undefined";
    return;
  }

  if (blockIndex > attributes.blocks.length) {
    //console.error(`blockIndex is out of bounds (${blockIndex} > ${attributes.blocks.length})`);
    return;
  }

  const block = attributes.blocks[blockIndex];

  // console.log(blockIndex, column, attributes.blocks.length, block);

  return new Block(column, block, [x, y, z + column.offset]);
}

function loadPart(colData, attributes, y) {
  const cells = [];

  for (let x = 0; x < 256; x++) {
    const cell = loadCell(x, y, attributes, colData);
    cells.push(cell);
  }

  return cells;
}

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
  ].concat([
    [x, y, z],
    [x+1, y+1, z],
    [x+1, y, z],
  ]);
}

function generateVertexes(block, x, y, z) {
  return quad(x, y, z);
}

function* loadVertexes(parts) {
  const size = parts.length;
  let count = 0;

  for (let divider of subdivide(256, 32)) {
    let vertexes = [];

    for (let col of divider) {
      const [x, y] = col;
      const column = parts[y][x];

      for (let z = 0; z < column.length; z++) {
        const block = column[z];

        if (block === undefined) {
          continue;
        }

        vertexes = vertexes.concat(generateVertexes(block, x, y, z));
      }
    }

    yield { vertexes: flatten(vertexes), progress: count++ * 256, max: 256*256*2 }
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
      const height = attributes.columns[columnIndex] & 0xff;
      const offset = (attributes.columns[columnIndex] & 0xff00) >> 8;

      for (var z = 0; z < height; z++) {
        if (z >= offset) {
          const blockIndex = attributes.columns[columnIndex + z - offset];
          const block = attributes.blocks[blockIndex];

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

  draw(gl, shader, matrices) {
    shader.use();
    gl.uniformMatrix4fv(shader.uniform('uPMatrix'), false, matrices.p);
    gl.uniformMatrix4fv(shader.uniform('uVMatrix'), false, matrices.v);
    gl.uniformMatrix4fv(shader.uniform('uMMatrix'), false, matrices.m);

    this.models.forEach((model) => {
      model.draw(shader);
    });
  }

  addBlock(block, offset, part) {
    const rotation = 0;

    const lid = buildLid(block.slopeType);
    this.addFace(offset, part, block.lid, lid);
    this.addFace(offset, part, block.bottom, [
      [0, 0, -1],
      [1, 0, -1],
      lid[1],
      lid[0]
    ]);
    this.addFace(offset, part, block.top, [
      [0, 1, -1],
      [1, 1, -1],
      lid[2],
      lid[3]
    ]);
    this.addFace(offset, part, block.left, [
      [0, 0, -1],
      [0, 1, -1],
      lid[3],
      lid[0]
    ]);
    this.addFace(offset, part, block.right, [
      [1, 1, -1],
      [1, 0, -1],
      lid[1],
      lid[2]
    ]);
  }

  addFace(offset, part, face, quad) {
    const texture = (face & 0x3fff) >>> 0;
    const rotation = ((face >> 14) >>> 0) * 90;
    const flip = (face & 0x2000) >>> 0;

    if (!texture) {
      return;
    }

    let vertices = [];
  }
}

GTA2Map.load = function* load(gl, filename) {
  let data = null;

  for (let download of downloadAsset(filename)) {
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

  for (let part of loadParts(attributes)) {
    if (part.result) {
      parts.push(part.result);
    }
    yield { progress: part.progress, max: part.max, text: 'Decompressing map' };
  }

  const models = [];

  for (let part of loadVertexes(parts)) {
    if (part.vertexes) {
      const model = new Model(gl, gl.TRIANGLES);
      model.addBuffer('aVertexPosition', Float32Array.from(part.vertexes), 3);
      models.push(model);
    }

    yield { progress: part.progress, max: part.max, text: `Creating map models ${models.length}` };
  }

  yield { result: { models } };
}
