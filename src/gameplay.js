import GameState from './game_state';
import LoadingScreen from './loading_screen';
import Shader from './shader';
import BlobStore from './blob_store';
import GTA2Style from './gta2_style';
import GTA2Map from './gta2_map';
import Camera from './camera';
import { mat4 } from 'gl-matrix';
import { KEYS } from './input';

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

  update(ticks) {
    if (this.input.isDown(27)) {
      this.game.stop();
      return;
    }

    if (this.input.isDown(KEYS.W)) {
    }
    if (this.input.isDown(KEYS.S)) {
    }
    if (this.input.isDown(KEYS.A)) {
    }
    if (this.input.isDown(KEYS.D)) {
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
      -50 + Math.cos(t) * 50.0,
      50 + Math.sin(t) * 50.0,
      20.0
    ];

    const lookat = [
      -50 + Math.cos(t) * 10.0,
      50 + Math.sin(t) * 10.0,
      0.0,
    ];

    const [pMatrix, vMatrix] = this.camera.lookat(this.gl,
      eye,
      lookat,
      [0, 0, 1]
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
