import * as THREE from 'three';

/** Whole-campus evening mood, cosmetic only: fireflies and wind-carried leaves.
 * Both particle fields wrap around the camera in the vertex shader, so two draw calls
 * cover every place the visitor walks. No colliders, no sound. */
export function createEveningAmbience(){
  const group=new THREE.Group();group.name='festival-evening-ambience';group.visible=false;
  const time={value:0},centre={value:new THREE.Vector3()},pixelRatio={value:1};
  function field(name:string,count:number,box:THREE.Vector3,leaves:boolean){
    const base=new Float32Array(count*3),seed=new Float32Array(count*3);
    let s=leaves?977:2011;const random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
    for(let i=0;i<count;i++){base.set([random()*box.x,random()*box.y,random()*box.z],i*3);seed.set([random(),random(),random()],i*3);}
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(base,3));geometry.setAttribute('seed',new THREE.BufferAttribute(seed,3));
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:leaves?THREE.NormalBlending:THREE.AdditiveBlending,
      uniforms:{time,centre,pixelRatio,box:{value:box}},
      vertexShader:`uniform float time,pixelRatio;uniform vec3 centre,box;attribute vec3 seed;varying float glow;varying vec3 tint;
        void main(){
          vec3 p=position;float phase=seed.x*6.2832;
          ${leaves?`
          // One prevailing wind, with gusts; leaves fall and are carried sideways.
          float gust=.6+.4*sin(time*.23+seed.z*6.2832);
          p.x+=time*(2.6+seed.y*1.8)*gust+sin(time*.9+phase)*.8;
          p.z+=time*(.9+seed.z)*gust+cos(time*.7+phase)*.6;
          p.y-=time*(.55+seed.x*.5)+sin(time*1.7+phase)*.25;
          glow=.75;tint=mix(vec3(.50,.62,.30),vec3(.85,.66,.30),seed.y);
          float size=.20+seed.z*.14;`:`
          // Fireflies wander slowly near the ground and blink out of step.
          p.x+=sin(time*(.21+seed.y*.2)+phase)*2.4+time*.12;
          p.z+=cos(time*(.17+seed.z*.2)+phase*1.3)*2.4;
          p.y+=sin(time*(.4+seed.x*.3)+phase*2.)*.5;
          float blink=sin(time*(1.1+seed.y*1.6)+phase*3.);
          glow=smoothstep(.15,.9,blink)*.9+.06;tint=mix(vec3(1.,.93,.45),vec3(.72,1.,.5),seed.z);
          float size=.26+seed.x*.16;`}
          p=mod(p-centre+box*.5,box)-box*.5+centre;
          ${leaves?'':'p.y=.35+mod(position.y+sin(time*(.4+seed.x*.3)+phase*2.)*.5,box.y);'}
          vec4 view=modelViewMatrix*vec4(p,1.);
          // Fade at the wrap boundary so nothing pops in or out.
          vec3 edge=abs(p-centre)/(box*.5);glow*=1.-smoothstep(.78,1.,max(edge.x,edge.z));
          gl_Position=projectionMatrix*view;gl_PointSize=size*pixelRatio*520./max(1.,-view.z);
        }`,
      fragmentShader:`varying float glow;varying vec3 tint;
        void main(){vec2 c=gl_PointCoord-.5;${leaves?'float a=step(length(c*vec2(1.,2.1)),.5);':'float d=length(c)*2.;float a=exp(-d*d*4.5);'}
          if(a*glow<.02)discard;gl_FragColor=vec4(tint,a*glow);}`});
    const points=new THREE.Points(geometry,material);points.name=name;points.frustumCulled=false;points.renderOrder=6;group.add(points);return points;
  }
  const fireflies=field('festival-fireflies',220,new THREE.Vector3(90,3.4,90),false);
  const leaves=field('festival-wind-leaves',90,new THREE.Vector3(70,14,70),true);

  function update(dt:number,camera:THREE.Camera,enabled:boolean,reduced:boolean,dpr:number,effects=true){
    group.visible=enabled;if(!enabled)return;
    // Reduced motion keeps steady fireflies, without drift or falling leaves.
    if(!reduced)time.value+=Math.min(Math.max(dt,0),.1);
    fireflies.visible=effects;leaves.visible=effects&&!reduced;pixelRatio.value=dpr;
    centre.value.copy(camera.position);
  }
  return {group,update};
}
