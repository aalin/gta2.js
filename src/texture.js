import { loadImage } from './utils';

const PIXEL = new Uint8Array([255, 0, 255, 255]);

export default class Texture {
  static load(gl, imageSrc, index, opts = {}) {
    return loadImage(imageSrc).then((image) => new Texture(gl, index, image, opts));
  }

  constructor(gl, index, opts = { smooth: false }) {
    this.gl = gl;
    this.index = index;
    this.texture = gl.createTexture();
    console.log('Created texture', index);

    gl.activeTexture(gl.TEXTURE0 + this.index);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    this.setData(1, PIXEL);

    if (opts.wrap) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    if (opts.smooth) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
  }

  setData(size, data) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  setImage(image) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  destructor() {
    console.warn('Destructor for texture', this.texture);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + this.index);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.deleteTexture(this.texture);
  }
}
