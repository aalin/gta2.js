const FRAME_LENGTH = 1000.0 / 60.0;

const INITIAL_COUNT = 1;
const MAX_COUNT = 1000;

export default
class Counter {
  constructor(count = INITIAL_COUNT) {
    this.reset(count);
  }

  reset(count = INITIAL_COUNT) {
    this._lastUpdate = null;
    this._count = count
    this._i = 0;
    this._deltas = [];
  }

  getAverageDelta() {
    return this._deltas.reduce((sum, x) => sum + x, 0.0) / this._deltas.length;
  }

  update() {
    const now = new Date();
    const delta = now - this._lastUpdate;
    this._lastUpdate = now;

    if (!isNaN(delta)) {
      this._deltas.push(delta);
    }

    const doUpdate = (this._i++ % this._count) === 0;

    if (doUpdate && this._deltas.length) {
      this._recalibrate();
    }

    return doUpdate;
  }

  _recalibrate() {
    const mul = this.getAverageDelta() / FRAME_LENGTH;
    let count = Math.ceil(this._count * mul) || 0;
    this._count = Math.min(Math.max(1, count), MAX_COUNT);
    this._deltas = [];
    this._i = 0;
  }
}
