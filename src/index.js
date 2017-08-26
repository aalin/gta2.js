import { mat4, vec3, vec2 } from 'gl-matrix';

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

import Camera from './camera';
import Texture from './texture';
import Shader from './shader';
import Model from './model';
import GTA2Style from './gta2_style';
import GTA2Map from './gta2_map';
import Loaders from './loaders';

/*
GTA2Map.load('/levels/ste.gmp').then(() => {
  console.log('Map loaded');
});
*/

function createCanvas(zIndex = 0) {
  const canvas = document.createElement('canvas');
  canvas.id = `canvas-${zIndex}`;
  canvas.style.position = 'fixed';
  canvas.style.top = canvas.style.right = canvas.style.bottom = canvas.style.left = 0;
  canvas.style.height = canvas.style.width = '100%';
  canvas.width = window.innerWidth * 2;
  canvas.height = window.innerHeight * 2;
  canvas.style.zIndex = zIndex;
  document.body.appendChild(canvas);
  return canvas;
}

function deg2rad(deg) {
  return deg * Math.PI / 180.0;
}

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

const KEY_W = 87;
const KEY_A = 65;
const KEY_S = 83;
const KEY_D = 68;
const KEY_SPACE = 32;

function update(state, step, input) {
  let xAdd = 0;
  let yAdd = 0;
  const speed = 0.002;
  const delta = step - (state.step || step);

  if (input.isDown(KEY_W)) { yAdd--; }
  if (input.isDown(KEY_S)) { yAdd++; }
  if (input.isDown(KEY_A)) { xAdd--; }
  if (input.isDown(KEY_D)) { xAdd++; }

  const playerPos = [0, 0];

  return Object.assign({}, state, {
    x: playerPos[0],
    y: playerPos[1],
    delta,
    step,
    ortho: false, // Math.sin(step / 1000.0) > 0.0,
    zoom: 50 + Math.sin(step / 5000.0) * 40.0
  });
}

function setupControls() {
  const canvas = createCanvas(0);
  const gl = initGL(canvas);
  const input = new Input();
  const camera = new Camera();

  gl.clearColor(0.93, 0.94, 0.91, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  return { gl, input, camera };
}

function setupTextCanvas() {
  const canvas = createCanvas(1);
  const ctx = canvas.getContext('2d');

  return { canvas, ctx }
}

class Game {
  constructor(level) {
    this.loaders = new Loaders();

    this.ticks = 0;
    this.state = {};
    this.nextState = {};
    this.nextStateCallbacks = [];

    this.loaders.on('load', (name, item) => {
      this.setState({ loadingText: null });
      this.items[name] = item;
    });

    this.loaders.on('update', (name, percent, text) => {
      const loadingText = [
        name.padEnd(10),
        text.padEnd(20),
        percent.toFixed(2).padStart(5) + "%"
      ].join(' ');

      this.setState({ loadingText });
    });

    this.running = false;
    this.items = {};

    this.input = new Input();

    this.controls = setupControls();
    this.canvas2d = setupTextCanvas();

    this._run = this._run.bind(this);

    // this.loaders.addLoader('map', GTA2Map.load(`/levels/${level}.gmp`));
    this.loaders.addLoader('style', GTA2Style.load(this.controls.gl, `/levels/${level}.sty`));
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
    this.running = false;
  }

  _run(ticks) {
    this.ticks = ticks;

    if (!this.running) {
      return;
    }

    this.update();
    this.draw();

    window.requestAnimationFrame(this._run);
  }

  update() {
    this.loaders.update();

    this._updateState();
  }

  draw() {
    // console.log('draw');

    /*
    if (Object.keys(this.items).length) {
      console.log(this.items);
      this.stop();
    }
    */
    const { canvas, gl, camera, input } = this.controls;

    //const [pMatrix, vMatrix] = camera.draw(gl, this.state, [0, 0, 0, 0]);
    const mMatrix =  mat4.create();
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.draw2d();
  }

  draw2d() {
    const { ctx, canvas } = this.canvas2d;

    if (!this.state.loadingText) {
      canvas.style.display = 'none';
      return;
    }

    canvas.style.display = 'block';

    const radius = 5.0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.font = '50px courier new';
    ctx.fillText(this.state.loadingText, 200, canvas.height / 2);
  }

  _updateState() {
    Object.assign(this.state, this.nextState);
    this.nextStateCallbacks.forEach((x) => x.call(null, this.state));
    this.nextStateCallbacks = [];
    this.nextState = {};
  }
}
const game = new Game('ste');
game.start();
