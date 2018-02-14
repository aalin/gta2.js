import { mat4, vec3 } from 'gl-matrix';

const Z_NEAR = 1.0;
const Z_FAR = 256.0;

export default class Camera {
  constructor() {
    this.pMatrix = mat4.create();
    this.vMatrix = mat4.create();
  }

  draw(gl, state, lookat) {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    const pMatrix = this.pMatrix;

    const screenRatio = gl.viewportWidth / gl.viewportHeight;

    let height = state.zoom;
    let ymin = -height / 2;
    let width = height * screenRatio;
    let xmin = -width / 2;

    if (screenRatio < 1.0) {
      [height, ymin, width, xmin] = [width, xmin, height, ymin];
    }

    mat4.ortho(pMatrix, xmin, xmin + width, ymin, ymin + height, -1.0, 500.0);

    const vMatrix = this.vMatrix;

    mat4.scale(vMatrix, vMatrix, [1.0, -1.0, 1.0]);
    mat4.translate(vMatrix, vMatrix, [-state.x, -state.y, -10.0]);

    return [pMatrix, vMatrix];
  }

  lookat(gl, eye, center, up) {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const pMatrix = this.pMatrix;
    mat4.perspective(pMatrix, 45.0, 1.0, Z_NEAR, Z_FAR);
    const vMatrix = this.vMatrix;
    mat4.lookAt(vMatrix, eye, center, up);
    return [pMatrix, vMatrix];
  }
}
