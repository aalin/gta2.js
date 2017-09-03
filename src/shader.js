function getShader(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    throw gl.getShaderInfoLog(shader);
  }

  return shader;
}

function initShaderProgram(gl, vertSrc, fragSrc) {
  const vertexShader = getShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fragmentShader = getShader(gl, gl.FRAGMENT_SHADER, fragSrc);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Could not initialize shaders');
    throw 'Could not initialize shaders';
  }

  return shaderProgram;
}

export default class Shader {
  constructor(gl, vertSrc, fragSrc) {
    this.gl = gl;
    this.shader = initShaderProgram(gl, vertSrc, fragSrc);

    const numUniforms = gl.getProgramParameter(this.shader, gl.ACTIVE_UNIFORMS);

    const uniforms = Array.from({ length: numUniforms }, (_, i) =>
      gl.getActiveUniform(this.shader, i)
    );

    this.uniformLocations = uniforms.reduce((obj, uniform) => {
      obj[uniform.name] = gl.getUniformLocation(this.shader, uniform.name);
      return obj;
    }, {});

    const numAttribs = gl.getProgramParameter(
      this.shader,
      gl.ACTIVE_ATTRIBUTES
    );
    const attribs = Array.from({ length: numAttribs }, (_, i) =>
      gl.getActiveAttrib(this.shader, i)
    );

    this.attribLocations = attribs.reduce((obj, attrib) => {
      obj[attrib.name] = gl.getAttribLocation(this.shader, attrib.name);
      return obj;
    }, {});
  }

  get uniforms() {
    return Object.keys(this.uniformLocations);
  }

  uniform(name) {
    if (this.uniformLocations[name]) {
      return this.uniformLocations[name];
    }

    throw `Invalid uniform: ${name}, has: ${Object.keys(this.uniformLocations).join(', ')}`;
  }

  attrib(name) {
    if (this.attribLocations[name] !== undefined) {
      return this.attribLocations[name];
    }

    throw `Invalid attrib: ${name}, has: ${Object.keys(this.attribLocations).join(', ')}`;
  }

  use() {
    this.gl.useProgram(this.shader);
  }
}

Shader.load = function load(gl, loadVertexShader, loadFragmentShader) {
  return function* (progress, done) {
    let vertexShader = null;
    let fragmentShader = null;

    loadVertexShader().then((shader) => {
      vertexShader = shader;
    });

    while (!vertexShader) {
      yield { progress: 0, max: 2, text: 'Loading vertex shader' };
    }

    loadFragmentShader().then((shader) => {
      fragmentShader = shader;
    });

    while (!fragmentShader) {
      yield { progress: 1, max: 2, text: 'Loading fragment shader' };
    }

    const result = new Shader(gl, vertexShader, fragmentShader);

    yield { result };
  }
}
