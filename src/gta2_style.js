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
  constructor(attributes) {
    Object.assign(this, attributes);
  }
}

GTA2Style.load = function* load(filename) {
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

  yield { result: new GTA2Style(style) };
}

