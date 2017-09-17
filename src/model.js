import VertexBuffer from './vertex_buffer';

const UINT16_MAX = 2 ** 16 - 1;

class IndexBuffer {
  constructor(gl, indices) {
    if (indices.length >= UINT16_MAX) {
      throw `Can't use more than ${UINT16_MAX} indices (got ${indices.length})`;
    }

    this.gl = gl;
    this.buffer = gl.createBuffer();
    this.bind();

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    this.count = indices.length;
  }

  bind() {
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffer);
  }

  draw(mode, offset = 0, count = this.count) {
    this.gl.drawElements(mode, count / 3, this.gl.UNSIGNED_SHORT, this.buffer);
  }
}

export default class Model {
  constructor(gl, drawMode = gl.TRIANGLES) {
    this.gl = gl;
    this.drawMode = drawMode;
    this.buffers = [];
    this.indices = null;
  }

  // attrib: aVertexPosition, aColor, aTexcoord
  // buffer: vertex buffer
  addBuffer(attrib, data, itemSize = 3) {
    const buffer = new VertexBuffer(this.gl, data, itemSize);
    this.buffers.push({ attrib, buffer });
    return this;
  }

  setIndices(indices) {
    this.indices = new IndexBuffer(this.gl, indices);
  }

  bindBuffers(shader) {
    this.buffers.forEach(({ attrib, buffer }) => {
      buffer.bind();
      const a = shader.attrib(attrib);
      this.gl.enableVertexAttribArray(a);
      this.gl.vertexAttribPointer(
        a,
        buffer.itemSize,
        this.gl.FLOAT,
        false,
        0,
        0
      );
    });
  }

  draw(shader) {
    if (!this.buffers.length) {
      console.error('Drawing a model without a buffer??');
      return;
    }

    this.bindBuffers(shader);

    if (this.indices) {
      this.indices.draw(this.drawMode || this.gl.TRIANGLES);
    } else {
      this.gl.drawArrays(
        this.drawMode || this.gl.TRIANGLES,
        0,
        this.buffers[0].buffer.numItems
      );
    }
  }
}
