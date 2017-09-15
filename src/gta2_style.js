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
  const textureSize = 4096;
  const pageSize = 256;
  const divisor = 992;
  const squared = Math.ceil(Math.sqrt(992));
  const tileSize = 64;

  const { canvas, ctx } = createTextureCanvas(2048);

  for (let tileIndex = 0; tileIndex < 992; tileIndex++) {
    const i = Math.floor(tileIndex % 32) * 64;
    const j = Math.floor(tileIndex / 32) * 64;
    const pageNum = Math.floor(tileIndex / 16);
    const pageOffset = 256 * 256 * pageNum;

    const paletteIndex = style.paletteIndex[tileIndex];

    const x = 64 * (tileIndex % 4);
    const y = 64 * (Math.floor(tileIndex / 4) % 4);

    for(let tileY = 0; tileY < 64; tileY++) {
      for(let tileX = 0; tileX < 64; tileX++) {
        const paletteIndex = style.paletteIndex[tileIndex];

        const px = i + tileX;
        const py = j + tileY;

        const idx = (y + tileY) * 256 + x + tileX;
        const c = style.tiles[pageOffset + idx];

        if (!c) {
          putPixel(ctx, px, py, [0, 0, 0, 0]);
        } else {
          const rgba = getPaletteValue(style.physicalPalettes, paletteIndex, c);
          putPixel(ctx, px, py, extractColor(rgba | 0xff000000));
        }
      }
    }

    yield { _type: `${tileIndex}/992`, _progress: tileIndex, _max: 992 };
  }

  canvas.id = `canvas-2`;
  canvas.style.position = 'fixed';
  canvas.style.top = canvas.style.right = canvas.style.bottom = canvas.style.left = 0;
  canvas.style.height = canvas.style.width = `${textureSize}px`;
  canvas.style.zIndex = 2;

  const texture = new Texture(gl, textureIndex, canvas);
  console.log('gl.MAX_TEXTURE_SIZE', gl.getParameter(gl.MAX_TEXTURE_SIZE));
  // document.body.appendChild(canvas);

  yield { texture };
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
  static load(gl, filename, textureIndex = 1) {
    return function* (progress, done) {
      let data = null;

      for (let download of downloadAsset(filename)) {
        if (download.data) {
          data = download.data;
          break;
        }

        yield progress(download.progress, download.max || 1, `Downloading ${filename}`);
      }

      const style = {};

      for (let details of parseStyle(data)) {
        if (details._progress) {
          yield progress(details._progress, details._max, `Parsing style (${details._type})`)
        } else {
          Object.assign(style, details);
        }
      }

      const textures = [];

      for (let details of loadTextures(gl, style, textureIndex)) {
        if (details._progress) {
          yield progress(details._progress, details._max, `Loading textures (${details._type})`)
        }

        if (details.texture) {
          textures.push(details.texture);
        }
      }

      console.log("Number of textures", textures.length);

      yield done(new GTA2Style(textures));
    }
  }

  constructor(textures) {
    this.textures = textures;
  }

  destructor() {
    this.textures.forEach(texture => texture.destructor());
  }

  draw() {
    //this.textures.each(texture => texture.bind())
  }
}
