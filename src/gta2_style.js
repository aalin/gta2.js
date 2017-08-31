import Texture from './texture';
import { downloadAsset } from './utils';
import loadChunks from './load_chunks';

function result(buffer, result) {
  return {
    progress: buffer.pos,
    max: buffer.length,
    result
  };
}

function getPaletteValue(paletteData, paletteIndex, colorIndex) {
  const pageStart = Math.floor((paletteIndex / 64)) * 64 * 256 * 4;
	const idx = pageStart + (paletteIndex % 64) + colorIndex * 64;
	const value = paletteData[idx];
  if (value === undefined) {
    throw `value: ${value}`;
  }
  return value;
}

function createTextureCanvas(size) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = size;
  canvas.height = size;

  return { ctx, canvas };
}

function putPixel(ctx, x, y, rgba) {
  const [r, g, b, a] = rgba;
  ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
  ctx.fillRect(x, y, 1, 1);
}

function extractColor(integer) {
  const a = ((integer >> 24) & 0xff) >>> 0;
  const r = ((integer >> 16) & 0xff) >>> 0;
  const g = ((integer >> 8) & 0xff) >>> 0;
  const b = ((integer >> 0) & 0xff) >>> 0;

  return [r, g, b, a];
}

let ADDED = false;

function* loadTextures(gl, style, textureIndex) {
  const pageSize = 256 * 256;
  const pagesPerTexture = 8;
  const pagesPerTexture2 = pagesPerTexture * pagesPerTexture
  let textureMap = {};

  for(let ii = 0; ii < Math.ceil(62 / pagesPerTexture2); ii++) {
    const { canvas, ctx } = createTextureCanvas(256 * pagesPerTexture);
    let allEmpty = true;

    for (let i = 0; i < pagesPerTexture; i++) {
      for (let j = 0; j < pagesPerTexture; j++) {
        const pageNum = ii * pagesPerTexture2 + i * pagesPerTexture + j;
        const pageOffset = pageSize * pageNum;

        for(let y = 0; y < 4; y++) {
          for(let x = 0; x < 4; x++) {
            const tileIndex = pageNum * 16 + y * 4 + x;
            const paletteIndex = style.paletteIndex[tileIndex];

            let hasTransparency = false;

            textureMap[tileIndex] = [
              i * 256 + x * 64 + 0,
              j * 256 + y * 64 + 0,
            ];

            for(let tileY = 0; tileY < 64; tileY++) {
              for(let tileX = 0; tileX < 64; tileX++) {
                const idx = (y * 64 + tileY) * 256 + x * 64 + tileX;
                const c = style.tiles[pageOffset + idx];

                const px = i * 256 + x * 64 + tileX;
                const py = j * 256 + y * 64 + tileY;

                if (!c) {
                  hasTransparency = true;
                  putPixel(ctx, px, py, [0, 0, 0, 0]);
                } else {
                  allEmpty = false;
                  const rgba = (getPaletteValue(style.physicalPalettes, paletteIndex, c) | 0xff000000) >>> 0;
                  putPixel(ctx, px, py, extractColor(rgba));
                }
              }
            }

            yield { _message: "hatt", _progress: pageNum, _max: 62 };

            //yield { texture };
          }
        }
      }

      if (allEmpty) {
        console.error('All textures are empty');
        break;
      }
    }

    canvas.id = `canvas-2`;
    canvas.style.position = 'fixed';
    canvas.style.top = canvas.style.right = canvas.style.bottom = canvas.style.left = 0;
    canvas.style.height = canvas.style.width = `${256 * pagesPerTexture}px`;
    canvas.style.zIndex = 2;

    const texture = new Texture(gl, textureIndex + ii, canvas);
    console.log(gl.getParameter(gl.MAX_TEXTURE_SIZE));
    if (!ADDED) {
      //document.body.appendChild(canvas);
      //ADDED = true;
    }

    yield { texture };
    // console.log(canvas);
  }

  yield { textureMap };
}

function* parseStyle(data) {
  for (let chunk of loadChunks(data, 'GBST', 700)) {
    console.log('chunk', chunk);
    const { type, size, buffer } = chunk;

    yield { _type: type, _progress: buffer.pos, _max: buffer.length };

    switch (type) {
      case 'PALX': // Palette index
        yield { paletteIndex: buffer.read16arrayLE(size) };
        break;
      case 'PPAL': // Physical palettes
        yield { physicalPalettes: buffer.read32arrayLE(size) };
        break;
      case 'PALB': // Palette base
        yield {
          paletteBase: {
            tile: buffer.read16(),
            sprite: buffer.read16(),
            carRemap: buffer.read16(),
            pedRemap: buffer.read16(),
            codeObjRemap: buffer.read16(),
            mapObjRemap: buffer.read16(),
            userRemap: buffer.read16(),
            fontRemap: buffer.read16(),
          }
        };
        break;
      case 'TILE': // Tile
        yield { tiles: buffer.read8arrayLE(size) };
        break;
      default:
        console.log(`Skipping ${size} bytes on "${type}", offset: ${buffer.pos}`);
        yield {};
        buffer.skip(size);
    }
  }
}

export default class GTA2Style {
  constructor(textures, textureMap) {
    this.textures = textures;
    this.textureMap = textureMap;
  }

  draw() {
    //this.textures.each(texture => texture.bind())
  }
}

GTA2Style.load = function* load(gl, filename, textureIndex = 1) {
  let data = null;

  for (let download of downloadAsset(filename)) {
    if (download.data) {
      data = download.data;
      break;
    }

    yield Object.assign(download, { text: `Downloading ${filename}` });
  }

  const style = {};

  for (let details of parseStyle(data)) {
    if (details._progress) {
      yield { progress: details._progress, max: details._max, text: `Parsing style (${details._type})` };
    } else {
      Object.assign(style, details);
    }
  }

  const textures = [];
  let textureMap = {};

  for (let details of loadTextures(gl, style, textureIndex)) {
    if (details._progress) {
      yield { progress: details._progress, max: details._max, text: `Loading textures textures (${details._type})` };
    }

    if (details.texture) {
      textures.push(details.texture);
    }

    if (details.textureMap) {
      textureMap = details.textureMap;
    }
  }

  console.log("Number of textures", textures.length);

  yield { result: new GTA2Style(textures, textureMap) };
}
