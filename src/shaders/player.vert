attribute vec3 aVertexPosition;

uniform mat4 uMMatrix;
uniform mat4 uVMatrix;
uniform mat4 uPMatrix;

uniform vec3 uPlayerPosition;

void main(void) {
  gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aVertexPosition, 1.0) + vec4(uPlayerPosition, 0) + vec4(0, 0, 10, 0);
}
