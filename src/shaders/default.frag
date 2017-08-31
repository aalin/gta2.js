precision mediump float;

uniform sampler2D uTexture;

varying vec4 vColor;
varying vec2 vTexCoord;

void main(void) {
  //gl_FragColor = mix(vColor, vec4(texture2D(uTexture, vTexCoord / 16.0).rgb, 1.0), 1.0);
  // gl_FragColor = vColor;
  gl_FragColor = texture2D(uTexture, vTexCoord);
  //gl_FragColor.a = 1.0;
  //gl_FragColor.r = 0.5;
}
