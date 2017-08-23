const EventEmitter = require('events').EventEmitter;

function percent(x, total) {
  return x / total * 100;
}

export default
class Loaders extends EventEmitter {
  constructor() {
    super();
    this.loaders = [];
  }

  addLoader(name, loader) {
    this.loaders.push({ name, loader });
  }

  update() {
    if (!this.loaders.length) {
      return;
    }

    const { name, loader } = this.loaders[0];
    const next = loader.next();

    if (next.done) {
      this.loaders.shift();
      return;
    }

    const value = next.value;

    if (value.progress) {
      this.emit('update', name, percent(value.progress, value.max), value.text || name);
    }

    if (value.result) {
      this.emit('load', name, value.result);
    }
  }
}
