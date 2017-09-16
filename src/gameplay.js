import GameState from './game_state';
import LoadingScreen from './loading_screen';
import Shader from './shader';
import BlobStore from './blob_store';
import GTA2Style from './gta2_style';
import GTA2Map from './gta2_map';
import Camera from './camera';
import { vec2, vec3, mat4 } from 'gl-matrix';
import { KEYS } from './input';

class Player {
  constructor(x, y) {
    this.position = vec3.fromValues(x, y, 0.0);
    this.direction = 0.0;
  }

  turn(amount) {
    this.direction += amount;
    console.log(this.direction);
    return this;
  }

  move(amount) {
    console.log("Moving", amount.toFixed(2));

    vec3.add(this.position, this.position, [
      Math.cos(this.direction * Math.PI) * amount,
      Math.sin(this.direction * Math.PI) * amount,
      0.0
    ]);
  }
}

export default
class Gameplay extends GameState {
  constructor(game, level) {
    super(game);

    this.addDependency('shader', () => (
      Shader.load(
        this.gl,
        () => System.import("./shaders/default.vert"),
        () => System.import("./shaders/default.frag"),
      )
    ));

    this.addDependency('blobStore', () => BlobStore.load('data'));

    this.addDependency('style', () => GTA2Style.load(this.gl, `/levels/${level}.sty`));
    this.addDependency('map', () => (
      GTA2Map.load(
        this.gl,
        `/levels/${level}.gmp`
      )
    ));

    this.level = level;

    this.camera = new Camera();
    this.player = new Player(-128, 128);
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

    const forwardSpeed = this.input.isDown(KEYS.SHIFT) ? 4.0 : 2.0;
    const backwardSpeed = 1.0;
    const turnSpeed = 3.0;

    if (this.input.isDown(KEYS.W)) {
    console.log(this.input.keys);
      this.player.move(forwardSpeed * delta);
    }

    if (this.input.isDown(KEYS.S)) {
      this.player.move(backwardSpeed * delta);
    }

    if (this.input.isDown(KEYS.A)) {
      this.player.turn(turnSpeed * delta);
    }

    if (this.input.isDown(KEYS.D)) {
      this.player.turn(-turnSpeed * delta);
    }

    if (this.input.isDown(KEYS.UP)) {
    }
    if (this.input.isDown(KEYS.DOWN)) {
    }
    if (this.input.isDown(KEYS.LEFT)) {
    }
    if (this.input.isDown(KEYS.RIGHT)) {
    }
  }

  draw(ticks) {
    const { map, shader, style } = this.resources;

    if (!(map && shader && style)) {
      return;
    }

    const cameraState = {
      zoom: 10.0
    };

    const t = ticks / 5000.0;

    const eye = [
      this.player.position[0],
      this.player.position[1],
      20.0
    ];

    const lookat = this.player.position;

    const [pMatrix, vMatrix] = this.camera.lookat(this.gl,
      eye,
      lookat,
      [0, 1, 0]
    );

    const matrices = {
      p: pMatrix,
      v: vMatrix,
      m: mat4.create()
    };

    //console.log(map);
    map.draw(this.gl, shader, matrices, style);
  }
}
