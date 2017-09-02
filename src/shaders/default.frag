precision mediump float;

uniform sampler2D uTexture;

varying vec2 vTexCoord;

float cutoff = 0.1;

void main(void) {
  gl_FragColor = texture2D(uTexture, vTexCoord);

  if (gl_FragColor.a < cutoff) {
    discard;
  }
}
