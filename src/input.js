export default
class Input {
  constructor() {
    this.keys = new Set();

    window.addEventListener('keydown', (e) => {
      e.preventDefault();
      this.keys.add(e.keyCode);
    });

    window.addEventListener('keyup', (e) => {
      e.preventDefault();
      this.keys.delete(e.keyCode);
    });
  }

  isDown(keyCode) {
    return this.keys.has(keyCode);
  }
}
