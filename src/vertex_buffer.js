export default class VertexBuffer {
  constructor(gl, vertices, itemSize = 3) {
    this.gl = gl;
    this.buffer = gl.createBuffer();
    this.bind();
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    this.itemSize = itemSize;
    this.numItems = vertices.length / this.itemSize;
  }

  bind() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
  }

  draw(mode = gl.TRIANGLES) {
    this.gl.drawArrays(mode, 0, this.numItems);
  }
}
