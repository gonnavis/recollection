uniform sampler2D tex;
varying vec2 vUv;

void main( void ) {

	vec4 col = texture2D( tex, vUv );

	col.w *= 0.2;

	gl_FragColor = col;

}