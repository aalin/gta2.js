export const KEYS = {
  W: 87,
  S: 83,
  A: 65,
  D: 68,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  SHIFT: 16,
  SPACE: 32
};

export default
class Input {
  constructor() {
    this.keys = new Set();

    window.addEventListener('keydown', (e) => {
      e.preventDefault();
      console.log('Pressed', e.keyCode);
      this.keys.add(e.keyCode);
    });

    window.addEventListener('keyup', (e) => {
      e.preventDefault();
      console.log('Released', e.keyCode);
      this.keys.delete(e.keyCode);
    });
  }

  isDown(keyCode) {
    return this.keys.has(keyCode);
  }
}
