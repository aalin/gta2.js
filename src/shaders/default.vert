attribute vec3 aVertexPosition;
attribute vec2 aTexCoord;

uniform mat4 uMMatrix;
uniform mat4 uVMatrix;
uniform mat4 uPMatrix;

varying vec2 vTexCoord;

void main(void) {
  gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aVertexPosition, 1.0);
  vTexCoord = aTexCoord;
}
