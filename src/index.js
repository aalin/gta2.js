import { mat4, vec3, vec2 } from 'gl-matrix';
import Texture from './texture';
import Model from './model';
import Input from './input';
import Gameplay from './gameplay';
import { wrapGameState } from './game_state';

const MAX_DELTA = 1.0 / 60.0;

function initGL(canvas) {
  try {
    const gl = canvas.getContext('experimental-webgl');
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    return gl;
  } catch (e) {
    alert('could not initialize webgl');
    throw e;
  }
}

function resize(canvas) {
  const realToCSSPixels = window.devicePixelRatio;

  const displayWidth  = Math.floor(window.innerWidth * realToCSSPixels);
  const displayHeight = Math.floor(window.innerWidth * realToCSSPixels);

  if (canvas.width  !== displayWidth || canvas.height !== displayHeight) {
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
  }
}

function createFullscreenCanvas(zIndex = 0) {
  const canvas = document.createElement('canvas');
  canvas.id = `canvas-${zIndex}`;
  canvas.style.position = 'fixed';
  canvas.style.top = canvas.style.right = canvas.style.bottom = canvas.style.left = 0;
  canvas.style.height = canvas.style.width = '100%';
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  canvas.style.zIndex = zIndex;
  //canvas.style.opacity = 0;
  //canvas.style.transition = 'opacity .2s, display .2s';
  document.body.appendChild(canvas);

  window.addEventListener('resize', () => {
    resize(canvas);
  });

  return canvas;
}

function deg2rad(deg) {
  return deg * Math.PI / 180.0;
}

function setupControls() {
  const canvas = createFullscreenCanvas(0);
  const gl = initGL(canvas);
  const input = new Input();

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  //gl.enable(gl.BLEND);
  //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // gl.enable(gl.CULL_FACE);
  // gl.cullFace(gl.BACK);

  return { gl, input };
}

function setupTextCanvas() {
  const canvas = createFullscreenCanvas(1);
  const ctx = canvas.getContext('2d');

  return { canvas, ctx }
}

class Game {
  constructor(level) {
    this.ticks = 0;
    this.delta = 0;
    this.state = {};
    this.nextState = {};
    this.nextStateCallbacks = [];

    this.running = false;

    this.input = new Input();

    this.controls = setupControls();
    this.canvas2d = setupTextCanvas();

    this.funcs2d = [];

    this._run = this._run.bind(this);

    this.states = [];

    this.pushState(new Gameplay(this, level));
  }

  addResource(name, value) {
    this.states.forEach((state) => {
      if (state.hasDependency(name)) {
        console.log('Setting resource', name, 'on', state.constructor.name);
        state.setResource(name, value);
      }
    });

    return this;
  }

  pushState(state, ...args) {
    if (typeof state === 'function') {
      state = new klass(this, ...args);
    } else {
      if (args.length) {
        throw `Args ${JSON.stringify(args)} passed when given state ${JSON.stringify(state)}`;
      }
    }

    this.states[0] && this.states[0].deactivate();

    this.states.unshift(wrapGameState(state));

    state.mount();
    state.activate();
  }

  popState() {
    const state = this.states.shift();

    if (!state) {
      return;
    }

    state.deactivate();
    state.unmount();

    const resourceNames = new Set(this.states.reduce((set, state) => set.concat(Array.from(Object.keys(state.getResources()))), []));

    const resources = state.getResources();

    console.log('Currently used resources', resourceNames);
    console.log('Resources used by current state', Object.keys(resources));

    for (let name of Object.keys(resources)) {
      if (!resourceNames.has(name)) {
        const resource = resources[name];

        console.log('Freeing resource', name);

        if (resource && typeof resource.destructor === 'function') {
          resource.destructor();
        }
      }
    }
  }

  setState(state, cb = null) {
    cb && this.nextStateCallbacks.push(cb);
    Object.assign(this.nextState, state);
  }

  start() {
    this.running = true;
    this._run(0);
  }

  stop() {
    while (this.states.length) {
      this.popState();
    }

    const canvas = this.controls.gl.canvas;
    canvas.width = 1;
    canvas.height = 1;
    canvas.parentNode && canvas.parentNode.removeChild(canvas);
  }

  _run(ticks) {
    this.delta = Math.max(ticks - this.ticks, MAX_DELTA);
    this.ticks = ticks;

    if (this.states.length === 0) {
      console.log('Stopping because there are no more states');
      this.stop();
      return;
    }

    this.update();
    this.draw();

    window.requestAnimationFrame(this._run);
  }

  update() {
    this.states[0] && this.states[0].update(this.ticks, this.delta / 1000.0);

    const { input } = this.controls;

    /*
    if (input.isDown(KEY_SPACE)) {
      this.stop();
    }
    */
  }

  draw() {
    const gl = this.controls.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.funcs2d = [];
    this.states[0] && this.states[0].draw(this.ticks);
    this._draw2d();
  }

  draw2d(fn) {
    this.funcs2d.push(fn);
  }

  _draw2d() {
    const { ctx, canvas } = this.canvas2d;

    if (!this.funcs2d.length) {
      if (canvas.style.display !== 'none') {
        //canvas.style.opacity = 0;
        canvas.style.display = 'none';
      }

      return;
    }

    if (canvas.style.display !== 'block') {
      canvas.style.display = 'block';
      //canvas.style.opacity = 1;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.funcs2d.forEach(fn => fn(ctx, canvas));
    this.funcs2d = [];
  }
}

const levels = ['wil', 'bil', 'ste'];
const level = 0;

const game = new Game(levels[level]);
game.start();
