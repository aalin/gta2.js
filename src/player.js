import { vec3 } from 'gl-matrix';
import Model from './model';

const RUN_SPEED = 4.0;
const WALK_SPEED = 2.0;
const TURN_SPEED = 0.5;
const BACKWARD_SPEED = -1.0;

export default
class Player {
  constructor(gl, x, y) {
    this.gl = gl;
    this.position = vec3.fromValues(x, y, 0.0);
    this.direction = 0.0;

    this.model = new Model(gl, gl.TRIANGLES);
    this.model.addBuffer('aVertexPosition', [
      0, 0, 0,
      1, 0, 0,
      1, 1, 0,
      0, 0, 0,
      1, 1, 0,
      0, 1, 0
    ], 3);
  }

  run(amount) { this._move(amount * RUN_SPEED); }
  walk(amount) { this._move(amount * WALK_SPEED); }
  back(amount) { this._move(amount * BACKWARD_SPEED); }

  turn(amount) {
    this.direction += amount * TURN_SPEED;
    console.log(this.direction);
    return this;
  }

  _move(amount) {
    console.log("Moving", amount.toFixed(2));

    vec3.add(this.position, this.position, [
      Math.cos(this.direction * Math.PI) * amount,
      Math.sin(this.direction * Math.PI) * amount,
      0.0
    ]);
  }

  draw(gl, shader, matrices) {
    shader.use();
    gl.uniformMatrix4fv(shader.uniform('uPMatrix'), false, matrices.p);
    gl.uniformMatrix4fv(shader.uniform('uVMatrix'), false, matrices.v);
    gl.uniformMatrix4fv(shader.uniform('uMMatrix'), false, matrices.m);
    gl.uniform3fv(shader.uniform('uPlayerPosition'), this.position);
    this.model.draw(shader);
  }
}
