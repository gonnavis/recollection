uniform float time;
uniform float seed;
uniform float phase;

uniform vec2 dataSize;
uniform sampler2D dataPos;
uniform sampler2D dataVel;
uniform float hideTrails;

$constants
$atan2
$noise4D

void main() {
    if(gl_FragCoord.x >= 1.0) return;    
    
    vec2 uv = gl_FragCoord.xy / dataSize.xy;
    vec3 pos = texture2D( dataPos, uv ).xyz;
    vec3 vel = texture2D( dataVel, uv ).xyz;
    float idParticle = uv.y * dataSize.x + uv.x;
    float scale = 0.1;
    
    vel.xyz += 40.0 * vec3(
      snoise( vec4( scale * pos.xyz, 7.225 * seed * 200.0 + 0.4 * time ) ),
      snoise( vec4( scale * pos.xyz, 3.553 * seed + 0.4 * time ) ),
      snoise( vec4( scale * pos.xyz, 1.259 * seed * 10.0 + 0.4 * time ) )
    ) * 0.05;

    vec3 gpos = pos - vec3(0.0, hideTrails * 20.0,0.0);
    vel += -(gpos)* length(gpos) * 0.03;

	//ground
	vel.y += smoothstep( 0.7, 1.0, 1.0 - abs( pos.y + 0.0 ) ) * 10.0;

	//raymarchObje	
	vec3 opos = pos - vec3( 0.0, 1.5, 0.0 );
	vel += smoothstep( 0.0, 0.5, 1.0 - length( opos ) ) * ( opos * 10.0 );

	vel.x += cos( atan2( pos.x, pos.z ) + 0.4) * 0.1 * length( pos.xz * 2.0 );
	vel.z -= sin( atan2( pos.x, pos.z ) + 0.4) * 0.1 * length( pos.xz * 2.0 );

    vel.xyz *= 0.9 + abs(sin(uv.y * 9.0)) * 0.05;
	
    gl_FragColor = vec4( vel.xyz, 1.0 );
}