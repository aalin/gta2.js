import BinaryBuffer from './binary_buffer';

function assert(condition, message) {
  if (!condition) {
    throw message;
  }
}

export default
function* loadChunks(data, header, version, callback) {
  const buffer = new BinaryBuffer(data);
  let style = {};

  const fileHeader = {
    hdr: buffer.readString(4),
    version: buffer.read16()
  };

  assert(fileHeader.hdr === header, `Wrong header: ${fileHeader.hdr}`);
  assert(fileHeader.version === version, `Wrong version: ${fileHeader.version}`);

  while (!buffer.eof()) {
    const chunkHeader = {
      type: buffer.readString(4),
      size: buffer.read32()
    };

    if (!/^[A-Z]{4}$/.test(chunkHeader.type)) {
      throw "chunk header mangled, bad position maybe?";
    }

    yield Object.assign({}, chunkHeader, { buffer });
  }
}
