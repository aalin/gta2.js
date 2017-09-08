import GameState from './game_state';
import Loaders from './loaders';

export default
class LoadingScreen extends GameState {
  constructor(game) {
    super(game);

    this.loaders = new Loaders();

    this.loaders.on('load', (name, item) => {
      this.setState({ loadingText: null });

      this.game.addResource(name, item);
      console.log('adding resource', name);

    });

    this.loaders.on('done', () => {
      this.game.popState();
    });

    this.loaders.on('update', (name, percent, text) => {
      const loadingText = [
        name.padEnd(10),
        text.padEnd(20),
        percent.toFixed(2).padStart(5) + "%"
      ].join(' ');

      this.setState({ loadingText });
    });
  }

  addLoader(name, loader) {
    this.loaders.addLoader(name, loader);
    return this;
  }

  update(ticks) {
    this.loaders.update();
  }

  draw() {
    if (this.state.loadingText) {
      this.game.draw2d((ctx, canvas) => {
        const radius = 5.0;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#000000';
        ctx.font = '50px courier new';
        ctx.fillText(this.state.loadingText, 200, canvas.height / 2);
      });
    }
  }
}
