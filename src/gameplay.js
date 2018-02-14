import GameState from './game_state';
import LoadingScreen from './loading_screen';
import Shader from './shader';
import GTA2Style from './gta2_style';
import GTA2Map from './gta2_map';
import Camera from './camera';
import { mat4, vec3 } from 'gl-matrix';
import { KEYS } from './input';
import Player from './player';

import vertexShader from './shaders/default.vert';
import fragmentShader from './shaders/default.frag';

import playerVertexShader from './shaders/player.vert';
import playerFragmentShader from './shaders/player.frag';

// const LEVEL_BASE_URI = process.env.NODE_ENV === 'production' ? 'http://gtamp.com/mapscript/_singleplayer/04_gta2files/extras/singleplayer/data' : '/levels';
const LEVEL_BASE_URI = document.location.pathname + 'levels'

export default
class Gameplay extends GameState {
  constructor(game, level) {
    super(game);

    this.addDependency('worldShader', () => (
      Shader.load(
        this.gl,
        () => Promise.resolve(vertexShader),
        () => Promise.resolve(fragmentShader),
        // () => System.import("./shaders/default.vert"),
        // () => System.import("./shaders/default.frag"),
      )
    ));

    this.addDependency('playerShader', () => (
      Shader.load(
        this.gl,
        () => Promise.resolve(playerVertexShader),
        () => Promise.resolve(playerFragmentShader),
        // () => System.import("./shaders/default.vert"),
        // () => System.import("./shaders/default.frag"),
      )
    ));

    this.addDependency('style', () => GTA2Style.load(this.gl, `${LEVEL_BASE_URI}/${level}.sty`));

    this.addDependency('map', () => (
      GTA2Map.load(
        this.gl,
        `${LEVEL_BASE_URI}/${level}.gmp`
      )
    ));

    this.level = level;

    this.camera = new Camera();
    this.player = new Player(this.gl, 128, 128);
    this.zoom = 0.0;
    this.cameraState = 0.0;
  }

  mount() {
    const level = this.level;

    const dependencyLoaders = this.getDependencyLoaders();

    if (dependencyLoaders.length === 0) {
      return;
    }

    const loadingScreen = new LoadingScreen(this.game);

    dependencyLoaders.forEach(({ name, loader }) => {
      loadingScreen.addLoader(name, loader);
    })

    this.game.pushState(loadingScreen);
  }

  activate() {
  }

  unmount() {
  }

  update(ticks, delta) {
    if (this.input.isDown(27)) {
      this.game.stop();
      return;
    }

    if (this.input.isDown(KEYS.W)) {
      if (this.input.isDown(KEYS.SHIFT)) {
        if (this.input.isDown(17)) {
          this.player.run(delta * 2);
        } else {
          this.player.run(delta);
        }
      } else {
        this.player.walk(delta);
      }
    } else if (this.input.isDown(KEYS.S)) {
      this.player.back(delta);
    }

    if (this.input.isDown(KEYS.A)) {
      this.player.turn(delta);
    }

    if (this.input.isDown(KEYS.D)) {
      this.player.turn(-delta);
    }

    this.player.update(delta);

    if (this.input.isDown(KEYS.UP)) {
    }
    if (this.input.isDown(KEYS.DOWN)) {
    }
    if (this.input.isDown(KEYS.LEFT)) {
    }
    if (this.input.isDown(KEYS.RIGHT)) {
    }

    if (this.input.isDown(KEYS.SPACE)) {
      this.cameraState += delta;
    } else {
      this.cameraState = 0.0;
    }

    if (this.input.isDown(90)) {
      this.zoom += delta * 10.0;
    }

    if (this.input.isDown(88)) {
      this.zoom -= delta * 10.0;
    }
  }

  draw(ticks) {
    const { map, worldShader, playerShader, style } = this.resources;

    if (!(map && worldShader && playerShader && style)) {
      return;
    }

    const t = ticks / 5000.0;

    const eye = vec3.create();
    const lookat = vec3.create();
    const up = vec3.create();

    if (this.cameraState > 0.01) {
      const forward = [
        Math.cos(this.player.direction * Math.PI),
        Math.sin(this.player.direction * Math.PI),
        0
      ];

      vec3.add(eye, this.player.position, [
        forward[0] * -10,
        forward[1] * -10,
        8
      ]);

      console.log(eye);

      vec3.add(lookat, lookat, this.player.position);

      vec3.set(up, 0, 0, 1);
    } else {
      vec3.add(eye, eye, [
        this.player.position[0],
        this.player.position[1],
        20 + this.zoom
      ]);

      vec3.add(lookat, lookat, this.player.position);

      vec3.set(up, 0, 1, 0);
    }

    const [pMatrix, vMatrix] = this.camera.lookat(this.gl,
      eye,
      lookat,
      up
    );

    const matrices = {
      p: pMatrix,
      v: vMatrix,
      m: mat4.create()
    };

    //console.log(map);
    map.draw(this.gl, worldShader, matrices, this.player.position, style);

    this.player.draw(this.gl, playerShader, matrices);
  }
}
