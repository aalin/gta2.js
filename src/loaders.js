import { EventEmitter } from 'events';
import Counter from './counter';

function percent(x, total) {
  return x / total * 100;
}

function* LoaderGenerator(loader) {
  const counter = new Counter();

  function progress(progress, max, text) {
    if (counter.update()) {
      return { progress, max, text, percent: progress / max * 100.0 };
    }
  }

  function done(result) {
    return { result };
  }

  for (let x of loader(progress, done)) {
    if (x) {
      yield x;

      if ('result' in x) {
        return;
      }
    }
  }
}

export default
class Loaders extends EventEmitter {
  constructor() {
    super();
    this.loaders = [];
  }

  addLoader(name, loader) {
    if (typeof loader === 'function') {
      loader = LoaderGenerator(loader);
    }

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
      console.log('Got result', value.result);
      this.emit('load', name, value.result);
    }
  }
}
