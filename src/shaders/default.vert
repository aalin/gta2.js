attribute vec3 aVertexPosition;
//attribute vec4 aVertexColor;

uniform mat4 uMMatrix;
uniform mat4 uVMatrix;
uniform mat4 uPMatrix;

varying vec4 vColor;

void main(void) {
  gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aVertexPosition, 1.0);
  // vColor = aVertexColor;
  vColor = vec4(0.0, 0.0, 0.0, 1.0);
}
