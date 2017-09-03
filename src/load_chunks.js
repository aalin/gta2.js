import BinaryBuffer, { StructReader } from './binary_buffer';

function assert(condition, message) {
  if (!condition) {
    throw message;
  }
}

const FileHeader = new StructReader({
  hdr: ['String', 4],
  version: '16LE'
});

const ChunkHeader = new StructReader({
  type: ['String', 4],
  size: '32LE'
})

export default
function* loadChunks(data, header, version, callback) {
  const buffer = new BinaryBuffer(data);
  let style = {};

  const fileHeader = buffer.readStruct(FileHeader);

  assert(fileHeader.hdr === header, `Wrong header: ${fileHeader.hdr}`);
  assert(fileHeader.version === version, `Wrong version: ${fileHeader.version}`);

  while (!buffer.eof()) {
    const chunkHeader = buffer.readStruct(ChunkHeader);

    if (!/^[A-Z]{4}$/.test(chunkHeader.type)) {
      throw "chunk header mangled, bad position maybe?";
    }

    yield Object.assign({}, chunkHeader, { buffer });
  }
}
