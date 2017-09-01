const FRAME_LENGTH = 1000.0 / 60.0;

export default
class Counter {
  constructor() {
    this.reset();
  }

  reset(count = 10) {
    this._lastUpdate = null;
    this._count = count
    this._i = 0;
  }

  update() {
    const now = new Date();
    const delta = now - this._lastUpdate;
    this._lastUpdate = now;

    if (delta && delta > FRAME_LENGTH) {
      if (this._count > 1) {
        console.log('Decreasing count');
        this._count--;
      }
    }

    this._i++;
    this._lastUpdate = now;

    return this._i % this._count === 0;
  }
}
