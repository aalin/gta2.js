const EventEmitter = require('events').EventEmitter;
const _game = Symbol('game');
const _nextState = Symbol('nextState');
const _nextStateCallbacks = Symbol('nextStateCallbacks');
const _state = Symbol('state');
const _dependencies = Symbol('dependencies');
const _resources = Symbol('resources');

class StateWrapper {
  constructor(state) {
    this[_state] = state;
  }

  mount() {
    this[_state].mount();
  }

  unmount() {
    this[_state].unmount();
  }

  activate() {
    this[_state].activate();
  }

  deactivate() {
    this[_state].deactivate();
  }

  update(ticks, delta) {
    this[_state].update(ticks, delta);
    this[_state]._updateState();
  }

  draw(ticks) {
    this[_state].draw(ticks);
  }

  setResource(name, value) {
    this[_state].setResource(name, value);
  }

  getResource(name) {
    return this[_state].getResource(name);
  }

  getResources() {
    return this[_state].getResources();
  }

  hasDependency(name) {
    return this[_state].hasDependency(name);
  }
}

export function
wrapGameState(gameState) {
  return new StateWrapper(gameState);
}


export default
class GameState extends EventEmitter {
  constructor(game) {
    super();
    this[_game] = game;

    this.state = {};
    this[_nextState] = {};
    this[_nextStateCallbacks] = [];

    this[_dependencies] = new Map();
    this[_resources] = {};
  }

  get game() {
    return this[_game];
  }

  setState(state, cb = null) {
    cb && this[_nextStateCallbacks].push(cb);
    Object.assign(this[_nextState], state);
  }

  _updateState() {
    Object.assign(this.state, this[_nextState]);
    this[_nextStateCallbacks].forEach((x) => x.call(null, this.state));
    this[_nextStateCallbacks] = [];
    this[_nextState] = {};
  }

  mount() {
    // Called when the state is initialized
  }

  unmount() {
    // Do cleanup here
  }

  activate() {
    // Called when state is activated
  }

  deactivate() {
    // Called when state is deactivated
  }

  update(_ticks) {
    // Called on each update
  }

  draw(_ticks) {
    // Called on each update
  }

  get resources() {
    return this[_resources];
  }

  get input() {
    return this.game.input;
  }

  get gl() {
    return this.game.controls.gl;
  }

  addDependency(name, loaderFn) {
    this[_dependencies].set(name, { loaderFn, value: null });
  }

  loadDependency(name) {
    return this[_dependencies].get(name).loaderFn();
  }

  setResource(name, value) {
    this[_resources][name] = value;
  }

  getResource(name) {
    return this[_resources][value];
  }

  getResources() {
    return this[_resources];
  }

  hasDependency(name) {
    return this[_dependencies].has(name);
  }

  getDependencyLoaders() {
    const result = [];

    for (let [name, dependency] of this[_dependencies]) {
      if (dependency.value === null) {
        const loader = dependency.loaderFn();
        result.push({ name, loader });
      }
    }

    return result;
  }
}
