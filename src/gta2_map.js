import { downloadAsset, promiseSerial, promiseSerialIter } from './utils';
import loadChunks from './load_chunks';
import { packIntLE } from './binary_buffer';
import { vec3 } from 'gl-matrix';
import BinaryBuffer, { StructReader } from './binary_buffer';

let ITERATIONS = 0;

const INT_SIZE = 4;

const COLUMN_STRUCT = new StructReader({
  height: '8LE',
  offset: '8LE',
  pad: '8LE',
  blockd: ['32arrayLE', 8 * INT_SIZE]
});

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

function buildBlock(block, blockOffset) {
  return { block: block, offset: blockOffset };
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
};

function parseMap(data) {
  let map = {};

  loadChunks(data, 'GBMP', 500, ({ type, size }, buffer) => {
    switch (type) {
      case 'DMAP':
        map.base = buffer.read32arrayLE(256 * 256 * INT_SIZE);

        const columnWords = buffer.read32LE();
        map.columns = buffer.read8arrayLE(columnWords * INT_SIZE);

        const numBlocks = buffer.read32LE();

        map.blocks = buffer.readStructs(numBlocks, {
          left: "16LE",
          right: "16LE",
          top: "16LE",
          bottom: "16LE",
          lid: "16LE",
          arrows: "8LE",
          slopeType: "8LE"
        });

        break;
      default:
        console.log(`Got type ${type}, skipping ${size}`);
        buffer.skip(size);
        break;
    }
  });

  return map;
}

function loadBlock(partSize, i, j, x, y, z, attributes) {
  return new Promise((resolve, reject) => {
    const offsetIndex = ((y + i * partSize) * 256 + x + j * partSize);
    const offset = attributes.base[offsetIndex];

    resolve({offsetIndex});

    if (offset === undefined) {
      return reject(`Could not find offset at index ${offsetIndex}`);
    }

    if (offset > attributes.columns.length) {
      return reject(`Offset is out of bounds (${offset} > ${attributes.columns.length})`);
    }

    const colData = new BinaryBuffer(attributes.columns);
    colData.skip(offset);

    const column = colData.readStruct(COLUMN_STRUCT);

    if (z < column.height - column.offset) {
      const blockIndex = column.blockd[z];

      if (blockIndex === undefined) {
        return reject("block index is undefined");
      }

      const blockOffset = [x, -y, z + column.offset];

      if (blockIndex > attributes.blocks.length) {
        return reject(`blockIndex is out of bounds (${blockIndex} to ${attributes.blocks.length})`);
      }

      const block = attributes.blocks[blockIndex];
      resolve(buildBlock(block, blockOffset));
    } else {
      resolve(null);
    }
  });
}

let ID = 0;

function loadPart(attributes, partSize, i, j) {
  console.log('Loading part', partSize, i, j);

  let printed = false;
  const promises = makeXYZIterator(partSize, partSize, 8, (x, y, z) => {
    return Promise.resolve(ID++);
  });

  return promiseSerialIter(promises);
}

function* makeXYZIterator(xmax, ymax, zmax, callback) {
  for (let z = 0; z < zmax; z++) {
    console.log('z', z);
    for (let y = 0; y < ymax; y++) {
      for (let x = 0; x < xmax; x++) {
        yield callback(x, y, z);
      }
    }
  }
}

function* makeXYIterator(xmax, ymax, callback) {
  for (let y = 0; y < ymax; y++) {
    for (let x = 0; x < xmax; x++) {
      yield callback(x, y);
    }
  }
}

function loadParts(attributes, partSize = 16) {
  const size = Math.floor(256 / partSize);

  const promises = makeXYIterator(size, size, (i, j) => {
    return loadPart(attributes, partSize, i, j);
  });

  return promiseSerialIter(promises);
}

export default
class GTA2Map {
  static load(filename) {
    return downloadAsset(filename).then((data) => {
      return new GTA2Map(parseMap(data));
    });
  }

  constructor(attributes) {
    this.blocks = [];

    const startAt = new Date();

    console.log('loading parts');
    // TODO: Try here without promises.
    // Implement a loader class which we can call on each update
    loadParts(attributes, 16).then((parts) => {
      console.log(parts.slice(-1)[0].slice(-1)[0]);
      console.log('got parts', parts.length);
      console.log('time', (new Date() - startAt) / 1000.0);
      console.log(ITERATIONS);
      console.log(parts);
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
