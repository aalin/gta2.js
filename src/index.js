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

GTA2Style.load('/levels/ste.sty').then(() => {
  console.log('Style loaded');
});


GTA2Map.load('/levels/ste.gmp').then(() => {
  console.log('Map loaded');
});

function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = canvas.style.right = canvas.style.bottom = canvas.style.left = 0;
  canvas.style.height = canvas.style.width = '100%';
  canvas.width = window.innerWidth * 2;
  canvas.height = window.innerHeight * 2;
  document.body.appendChild(canvas);
  return canvas;
}

function deg2rad(deg) {
  return deg * Math.PI / 180.0;
}

function drawScene(gl, { camera, shaders, models, textures, state }) {
  const [pMatrix, vMatrix] = camera.draw(gl, state, [0, 0, 0, 0]);
  const mMatrix =  mat4.create();

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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

function startGame() {
  const canvas = createCanvas();
  const gl = initGL(canvas);
  const input = new Input();
  const camera = new Camera();

  gl.clearColor(0.93, 0.94, 0.91, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let state = {
    x: 10.5,
    y: 7.5,
    pointingLeft: false,
    walking: false,
    jumping: false,
    ortho: true,
    zoom: 25
  };

  Promise.all([
    Promise.resolve({}),
    Promise.all([
      // createPaper(gl),
      // createPlayer(gl),
    ]),
    Promise.all([
      // Texture.load(gl, maptiles, 0),
      // Texture.load(gl, playersprite, 1),
      // Texture.load(gl, papertile, 3),
      // Texture.load(gl, hatch, 4, { smooth: true, wrap: true }),
    ]),
    Promise.all([
      // Shader.load(gl, 'default'),
      // Shader.load(gl, 'world'),
      // Shader.load(gl, 'player'),
      // Shader.load(gl, 'worldfill'),
    ])
  ]).then(([map, models, textures, shaders]) => {
    function animate(step) {
      state = update(state, step, input);
      drawScene(gl, { camera, shaders, models, textures, state, map });
      window.requestAnimationFrame(animate);
    }

    animate(0);
  });
}

startGame();
