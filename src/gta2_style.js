import Texture from './texture';
import { downloadAsset } from './utils';
import loadChunks from './load_chunks';

function parseStyle(data) {
  let style = {};

  loadChunks(data, 'GBST', 700, ({ type, size }, buffer) => {
    switch (type) {
      case 'PALX': // Palette index
        style.paletteIndex = buffer.read16arrayLE(size);
        break;
      case 'PPAL': // Physical palettes
        style.physicalPalettes = buffer.read32arrayLE(size);
        break;
      case 'PALB': // Palette base
        style.paletteBase = {
          tile: buffer.read16(),
          sprite: buffer.read16(),
          carRemap: buffer.read16(),
          pedRemap: buffer.read16(),
          codeObjRemap: buffer.read16(),
          mapObjRemap: buffer.read16(),
          userRemap: buffer.read16(),
          fontRemap: buffer.read16(),
        };
        break;
      case 'TILE': // Tile
        style.tiles = buffer.read8arrayLE(size);
        break;
      default:
        console.log(`Skipping ${size} bytes on "${type}", offset: ${buffer.pos}`);
        buffer.skip(size);
    }
  });

  return style;
}

export default class GTA2Style {
  static load(filename) {
    return downloadAsset(filename).then((data) => {
      return new GTA2Style(parseStyle(data));
    });
  }

  constructor(attributes) {
    Object.assign(this, attributes);
  }
}
