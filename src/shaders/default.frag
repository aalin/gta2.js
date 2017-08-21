precision mediump float;

varying vec4 vColor;

void main(void) {
  // gl_FragColor = mix(vColor, vec4(texture2D(uTexture, vTexCoord / 16.0).rgb, 1.0), 1.0);
  gl_FragColor = vColor;
}
