import { mat4, vec3, vec2 } from 'gl-matrix';
import Camera from './camera';
import Texture from './texture';
import Shader from './shader';
import Model from './model';
import GTA2Style from './gta2_style';
import GTA2Map from './gta2_map';
import Loaders from './loaders';
import BlobStore from './blob_store';
import Input from './input';

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

function createFullscreenCanvas(zIndex = 0) {
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

const KEY_W = 87;
const KEY_A = 65;
const KEY_S = 83;
const KEY_D = 68;
const KEY_SPACE = 32;

function setupControls() {
  const canvas = createFullscreenCanvas(0);
  const gl = initGL(canvas);
  const input = new Input();
  const camera = new Camera();

  gl.clearColor(0.93, 0.94, 0.91, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.cullFace(gl.FRONT_AND_BACK);

  return { gl, input, camera };
}

function setupTextCanvas() {
  const canvas = createFullscreenCanvas(1);
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

      if (name === 'map') {
        this.items[name] = new GTA2Map(item.models);
        return;
      }

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

    this.loaders.addLoader('shader',
      Shader.load(
        this.controls.gl,
        () => System.import("./shaders/default.vert"),
        () => System.import("./shaders/default.frag"),
      )
    );

    this.loaders.addLoader('blobStore', BlobStore.load('data'));

    this.loaders.addLoader(
      'style',
      GTA2Style.load(this.controls.gl, `/levels/${level}.sty`)
    );

    this.loaders.addLoader(
      'map',
      GTA2Map.load(
        this.controls.gl,
        `/levels/${level}.gmp`,
        () => ({ style: this.items.style, blobStore: this.items.blobStore })
      ),
    );
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

    const { input } = this.controls;

    if (input.isDown(KEY_SPACE)) {
      this.stop();
    }

    let forward = this.state.forward || 0.0;
    let stride = this.state.stride || 0.0;

    if (input.isDown(KEY_W)) { forward += 1.0; }
    if (input.isDown(KEY_S)) { forward -= 1.0; }
    if (input.isDown(KEY_A)) { stride -= 1.0; }
    if (input.isDown(KEY_D)) { stride == 1.0; }

    this.setState({ forward, stride });

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

    const cameraState = {
      zoom: 10.0
    };

    const t = this.ticks / 5000.0;

    const eye = [
      -50 + Math.cos(t) * 50.0,
      50 + Math.sin(t) * 50.0,
      20.0
    ];

    const lookat = [
      -50 + Math.cos(t) * 10.0,
      50 + Math.sin(t) * 10.0,
      0.0,
    ];

    const [pMatrix, vMatrix] = camera.lookat(gl,
      eye,
      lookat,
      [0, 0, 1]
    );

    const matrices = {
      p: pMatrix,
      v: vMatrix,
      m: mat4.create()
    };

    if (this.items.map) {
      if (this.items.shader) {
        this.items.map.draw(gl, this.items.shader, matrices, this.items.style);
      }
    }

    this.draw2d();
  }

  draw2d() {
    const { ctx, canvas } = this.canvas2d;

    if (this.state.loadingText) {
      canvas.style.display = 'block';
    } else {
      canvas.style.display = 'none';
      return;
    }

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
