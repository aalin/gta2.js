const _resources = Symbol('resources');
const _released = Symbol('released');
const _name = Symbol('name');
const _constant = Symbol('constant');

const logger = {
  log(...args) {
    console.log(`\x1b[37m`, ...args, `\x1b[0m`)
  },
  warn(...args) {
    console.log(`\x1b[33m`, ...args, `\x1b[0m`)
  },
  error(...args) {
    console.log(`\x1b[31m`, ...args, `\x1b[0m`)
  }
};

class ProxyHandler {
  static build(resources, name, value, constant) {
    switch (typeof value) {
      case 'object':
        return new Proxy(value, new ProxyHandler(resources, name, constant));
      case 'function':
      default:
        return value;
    }
  }

  constructor(resources, name, constant = false) {
    this[_resources] = resources;
    this[_name] = name;
    this[_released] = false;
    this[_constant] = constant;
  }

  get(target, name) {
    if (this[_released]) {
      throw `Trying to get ${name} on released object`;
    }

    if (name === '__release') {
      return () => {
        this[_resources].release(this[_name]);
        this[_released] = true;
      };
    }

    return target[name];
  }

  set(target, name, value) {
    if (this[_constant]) {
      throw `Can't set ${name} on constant object ${target}`;
    }

    target[name] = value;

    return true;
  }
}

export default
class Resources {
  constructor() {
    this[_resources] = new Map();
  }

  has(name) {
    return this[_resources].has(name);
  }

  set(name, value, cb = null) {
    if (this.has(name)) {
      throw `${name} is already set`;
    }

    logger.warn('Setting', name);

    this[_resources].set(name, { refcount: 0, value });

    if (cb) {
      return this.use(name, cb);
    }
  }

  use(name, constant, cb = null) {
    if (typeof constant === 'function' && cb === null) {
      cb = constant;
      constant = true;
    } else {
      throw `Invalid arguments: ${typeof constant}, ${typeof cb}`;
    }

    const resource = this.acquire(name, constant);
    const res = cb(resource);

    if (res instanceof Promise) {
      res.catch((e) => logger.error(e)).then(() => this.release(name));
      return;
    }

    this.release(name);
  }

  acquire(name, constant) {
    const resource = this[_resources].get(name);

    if (!resource) {
      throw `Can not aquire ${name}, has: ${Array.from(this[_resources].keys()).join()}`;
    }

    resource.refcount++;

    logger.warn('Aquiring', name, 'refcount:', resource.refcount)

    return new ProxyHandler.build(this, name, resource.value, constant);
  }

  release(name) {
    const resource = this[_resources].get(name);

    if (!resource) {
      throw `Can not release ${name}`;
    }

    resource.refcount--;

    logger.warn('Releasing', name, 'refcount:', resource.refcount)

    if (resource.refcount === 0) {
      logger.warn('Deleting', name);

      if (typeof resource.value.destructor === 'function') {
        resource.value.destructor();
      }

      this[_resources].delete(name);
    }
  }
}

/*
const resources = new Resources();

resources.set('hatt', {
  yolo() {
    return 'swag';
  },

  hello(count) {
    return `Hatthello ${count}`;
  },

  destructor() {
    console.log('Hatt destructor');
  }
});

let helloCount = 0;

resources.set('hello', { foo: () => `Hello ${helloCount++}` }, hello => {
  logger.log(hello.foo());

  resources.use('hello', hello2 => {
    logger.log(hello2.foo());

    resources.use('hello', hello3 => {
      logger.log(hello3.foo());
    });

    resources.use('hatt', hatt => {
      try {
        hatt.hej = 5;
        console.log(hatt);
      } catch (e) {
        logger.error(e);
      }

      return new Promise((resolve) => {
        const fn = (count = 0) => {
          console.log('hatt', count, hatt.hello(count));

          if (count >= 5) {

            resolve();
            return;
          }

          setTimeout(fn.bind(null, count + 1), 200);
        }

        fn();
      });
    });
  })
});
*/
