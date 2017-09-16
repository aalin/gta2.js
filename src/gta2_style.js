import Texture from './texture';
import { downloadAsset } from './utils';
import loadChunks from './load_chunks';
import { StructReader } from './binary_buffer';

const SpriteEntry = new StructReader({
  ptr: '32LE',
  w: '8LE',
  h: '8LE',
  pad: '16LE',
});

const SpriteBase = new StructReader({
  car: '16LE',
  ped: '16LE',
  codeObj: '16LE',
  mapObj: '16LE',
  user: '16LE',
  font: '16LE',
});

function OffsetedPaletteBase(pb) {
  let acc = 0;

  for (let key in pb) {
    if (pb.hasOwnProperty(key)) {
      this[key] = acc;
      acc += pb[key];
    }
  }
}

const PaletteBase = new StructReader({
  tile: '16LE',
  sprite: '16LE',
  carRemap: '16LE',
  pedRemap: '16LE',
  codeObjRemap: '16LE',
  mapObjRemap: '16LE',
  userRemap: '16LE',
  fontRemap: '16LE',
});

function result(buffer, result) {
  return {
    progress: buffer.pos,
    max: buffer.length,
    result
  };
}

function getPaletteIndex(paletteIndex, colorIndex) {
  const pageStart = Math.floor((paletteIndex / 64)) * 64 * 256 * 4;
  return pageStart + (paletteIndex % 64) + colorIndex * 64;
}

function getPaletteValue(paletteData, paletteIndex, colorIndex) {
  const idx = getPaletteIndex(paletteIndex, colorIndex)
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

function* loadSprites(gl, style, textureIndex) {
  const textureSize = 2048;
  const pageSize = 256;

  const { canvas, ctx } = createTextureCanvas(textureSize);

  for (let pageNum = 0; pageNum < 32; pageNum++) {
    const i = Math.floor(pageNum % 8) * 256;
    const j = Math.floor(pageNum / 8) * 256;

    const pageOffset = 256 * 256 * pageNum;
    const paletteIndex = style.paletteIndex[pageNum];

    const x = 256 * (pageNum % 8);
    const y = 256 * (Math.floor(pageNum / 8) % 8);

    for(let pageY = 0; pageY < 256; pageY++) {
      for(let pageX = 0; pageX < 256; pageX++) {
        const px = i + pageX;
        const py = j + pageY;

        const idx = (y + pageY) * 256 + x + pageX;
        const c = style.spriteGraphics[pageOffset + idx];

        if (!c) {
          putPixel(ctx, px, py, [0, 0, 0, 0]);
        } else {
          const idx = getPaletteIndex(paletteIndex, c) + style.paletteBase.tile * 256;

          const rgba = style.physicalPalettes[idx];
          putPixel(ctx, px, py, extractColor(rgba | 0xff000000));
        }
      }
    }

    yield { _type: `${pageNum}/32`, _progress: pageNum, _max: 32 };
  }

  canvas.id = `canvas-2`;
  canvas.style.position = 'fixed';
  canvas.style.top = canvas.style.right = canvas.style.bottom = canvas.style.left = 0;
  canvas.style.height = canvas.style.width = `${textureSize}px`;
  canvas.style.zIndex = 2;

  const texture = new Texture(gl, textureIndex, canvas);
  console.log('gl.MAX_TEXTURE_SIZE', gl.getParameter(gl.MAX_TEXTURE_SIZE));
  document.body.appendChild(canvas);

  yield { texture };
}

function* loadTextures(gl, style, textureIndex) {
  const textureSize = 2048;
  const pageSize = 256;
  const divisor = 992;
  const squared = Math.ceil(Math.sqrt(992));
  const tileSize = 64;

  const { canvas, ctx } = createTextureCanvas(textureSize);

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

const CHUNKS = {
  PALETTE_INDEX: 'PALX',
  PHYSICAL_PALETTES: 'PPAL',
  PALETTE_BASE: 'PALB',
  TILE: 'TILE',
  SPRITE_GRAPHICS: 'SPRG',
  SPRITE_INDEX: 'SPRX',
  SPRITE_BASES: 'SPRB',
};

function* parseStyle(data) {
  for (let chunk of loadChunks(data, 'GBST', 700)) {
    console.log('chunk', chunk);
    const { type, size, buffer } = chunk;

    yield { _type: type, _progress: buffer.pos, _max: buffer.length };

    switch (type) {
      case CHUNKS.PALETTE_INDEX:
        yield { paletteIndex: buffer.read16arrayLE(size) };
        break;
      case CHUNKS.PHYSICAL_PALETTES:
        yield { physicalPalettes: buffer.read32arrayLE(size) };
        break;
      case CHUNKS.PALETTE_BASE:
        yield { paletteBase: new OffsetedPaletteBase(buffer.readStruct(PaletteBase)) };
        break;
      case CHUNKS.TILE:
        yield { tiles: buffer.read8arrayLE(size) };
        break;
      case CHUNKS.SPRITE_GRAPHICS:
        yield { spriteGraphics: buffer.read8arrayLE(size) };
        break;
      case CHUNKS.SPRITE_INDEX:
        yield { spriteIndex: buffer.read8arrayLE(size) };
        break;
      case CHUNKS.SPRITE_BASES:
        yield { spriteBases: buffer.read8arrayLE(size) };
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

      for (let details of loadSprites(gl, style, textureIndex + 1)) {
        if (details._progress) {
          yield progress(details._progress, details._max, `Loading textures (${details._type})`)
        }

        if (details.texture) {
          textures.push(details.texture);
        }
      }

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
