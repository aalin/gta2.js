import { vec3 } from 'gl-matrix';

const RUN_SPEED = 4.0;
const WALK_SPEED = 2.0;
const TURN_SPEED = 0.5;
const BACKWARD_SPEED = -1.0;

export default
class Player {
  constructor(x, y) {
    this.position = vec3.fromValues(x, y, 0.0);
    this.direction = 0.0;
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
}