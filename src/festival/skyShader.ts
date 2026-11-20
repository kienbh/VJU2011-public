export const skyVertex='varying vec3 skyDirection;void main(){skyDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }';
export const skyFragment=`uniform vec3 top;uniform vec3 horizon;uniform float dusk;uniform float cloudAmount;varying vec3 skyDirection;
float cloudHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cloudNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(cloudHash(i),cloudHash(i+vec2(1,0)),f.x),mix(cloudHash(i+vec2(0,1)),cloudHash(i+vec2(1)),f.x),f.y);}
void main(){vec3 d=normalize(skyDirection);float y=d.y;vec3 color=mix(horizon,top,smoothstep(-.05,.72,y));vec2 uv=d.xz/(.28+max(y,0.))*2.5;float n=cloudNoise(uv)*.7+cloudNoise(uv*2.1)*.3;float cloud=smoothstep(.44,.72,n)*smoothstep(.03,.16,y)*(1.-smoothstep(.5,.82,y));color=mix(color,vec3(.45,.48,.59),cloud*.23*dusk*cloudAmount);float angle=acos(clamp(dot(d,normalize(vec3(-.42,.32,-.85))),-1.,1.));color+=vec3(.12,.10,.09)*exp(-angle*14.)*dusk;color=mix(color,vec3(1.,.91,.75),(1.-smoothstep(.013,.015,angle))*dusk);gl_FragColor=vec4(color,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
