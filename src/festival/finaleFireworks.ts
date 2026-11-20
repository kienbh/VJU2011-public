import * as T from 'three';
import {FINALE_SECONDS,FINALE_PLAN,FINALE_SHELLS,FINALE_PARTICLES,finaleBudget,finaleHalo,finaleHash,type FinaleShell} from './finalePlan';

/** Physically shaped GPU fireworks, evaluated in closed form from the single finale clock.
 * Stars follow drag + gravity (fast burst, slow drift, drooping fall); trails are camera-facing ribbons
 * sampled from the same world-space trajectory at earlier times, so no per-frame CPU simulation or history buffers.
 * Three draws: additive trail ribbons, colour heads (normal blend) and soft additive halo/flash.
 * Layout uniforms are set in setProgress; onBeforeRender only touches pixel ratio and viewport (reflection-safe). */
const SEG=6;
const PALETTES=[['#ff4b5c','#ffd36b','#fff3d6'],['#5cc8ff','#c9f1ff','#ffd36b'],['#b678ff','#ff9de2','#fff3d6'],['#57f08c','#ffe27a','#d7fff0'],['#ff8a3d','#ffd36b','#ff5fa2']];
const GOLD='#ffc766',EMBER='#ff6a1f',ROCKET='#ffd38a';

export function createFinaleFireworks(){
  const points=new T.Group();points.name='finale-fireworks';points.visible=false;
  const N=FINALE_PARTICLES;
  const origin=new Float32Array(N*3),tall=new Float32Array(N*2),vel=new Float32Array(N*3),time=new Float32Array(N*4),param=new Float32Array(N*4),col=new Float32Array(N*3),col2=new Float32Array(N*3);
  const c=new T.Color(),c2=new T.Color(),dir=new T.Vector3(),rot=new T.Euler(),q=new T.Quaternion();let n=0;
  function write(s:FinaleShell,start:number,life:number,kind:number,seed:number,v:T.Vector3,k:number,g:number,trail:number,size:number,head:T.Color,tail:T.Color){
    origin.set([s.wide[0]+1,s.wide[1],s.z],n*3);tall.set([s.tall[0]+1,s.tall[1]],n*2);vel.set([v.x,v.y,v.z],n*3);
    time.set([start,life,kind,seed],n*4);param.set([k,g,trail,size],n*4);col.set([head.r,head.g,head.b],n*3);col2.set([tail.r,tail.g,tail.b],n*3);n++;
  }
  // Rockets and flashes first: a reduced budget never removes a launch or the burst flash.
  for(const s of FINALE_PLAN){
    write(s,s.launch,s.flight,-1,s.seed,dir.set(s.ground[0]+1,s.ground[1]+1,0),0,0,.32,.3,c.set(ROCKET),c2.set(EMBER));
    write(s,s.burst,.22,-2,s.seed,dir.set(0,0,0),0,0,0,s.radius*.55,c.set('#fff1d8'),c2.set('#ffd9a0'));
  }
  // Stars interleaved across shells so budget cuts thin every burst evenly.
  const maxStars=Math.max(...FINALE_PLAN.map(s=>s.stars));
  for(let i=0;i<maxStars;i++)for(const s of FINALE_PLAN){
    if(i>=s.stars)continue;
    const h=finaleHash(s.index*31+i,1),h2=finaleHash(s.index*17+i,2),h3=finaleHash(s.index*13+i,3),seed=finaleHash(s.index+i*.37,4);
    const palette=PALETTES[(s.index*3+s.kind)%PALETTES.length];let k=2.1,g=9,trail=.2,size=.24,speed=1;
    // Fibonacci sphere, rotated per shell, with seeded jitter: full 3D (no z squash), avoiding visible rows.
    const yy=1-2*((i+.5)/s.stars),r=Math.sqrt(Math.max(0,1-yy*yy)),a=i*2.3999632297+s.seed*6.28;
    dir.set(r*Math.cos(a)+(h-.5)*.12,yy+(h2-.5)*.12,r*Math.sin(a)+(h3-.5)*.12).normalize();
    rot.set(s.seed*3,s.seed*5,0);dir.applyEuler(rot);
    c.set(palette[0]);c2.copy(c).multiplyScalar(.55).lerp(c.clone().set(EMBER),.35);
    if(s.kind===0){ // peony: colour stars, short glowing trail, inner pistil in the second colour
      speed=.9+.15*h;if(i%4===0){speed*=.55;c.set(palette[1]);c2.copy(c).multiplyScalar(.6);}
    }else if(s.kind===4){ // chrysanthemum: coloured tips on long gold spark tails
      k=1.75;g=10;trail=.5;speed=.92+.12*h;c2.set(GOLD);
    }else if(s.kind===3){ // willow: dim gold, high drag, long hanging trails
      k=2.6;g=16;trail=1.1;speed=.85+.15*h;size=.2;c.set(GOLD);c2.set(EMBER);
    }else{ // heart / ring: readable outline on a slightly tilted plane, a few stray sparks
      k=2.5;g=5.5;trail=.14;const t=i/s.stars*Math.PI*2;
      if(s.kind===1)dir.set(Math.pow(Math.sin(t),3),(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/16,0);
      else dir.set(Math.cos(t),Math.sin(t),0);
      rot.set(s.kind===2?.35+s.seed*.6:(s.seed-.5)*.3,(s.seed-.5)*.6,0);dir.applyQuaternion(q.setFromEuler(rot));
      speed=i%6===0?.45+.5*h:.95+.08*h;c.set(palette[s.index%2?1:0]);c2.copy(c).multiplyScalar(.6);
    }
    const life=s.life*(.72+.28*h2);
    dir.multiplyScalar(s.radius*k*speed);
    write(s,s.burst,life,s.kind,seed,dir,k,g,trail*(.8+.4*h3),size*(.85+.3*h),c,c2);
  }
  const shared=`uniform float uTime,uTall,uPixel;uniform vec2 uViewport;
    attribute vec3 aOrigin,aVel,aColor,aColor2;attribute vec2 aTall;attribute vec4 aTime,aParam;
    vec3 centre(){vec3 c=aOrigin;c.xy=mix(c.xy,aTall,uTall);return c;}
    vec3 travel(float t){vec3 c=centre();
      if(aTime.z<-.5&&aTime.z>-1.5){float u=clamp(t/aTime.y,0.,1.),x0=mix(aVel.x,aVel.y,uTall);
        vec3 p=vec3(mix(x0,c.x,u),3.+(c.y-3.)*(1.-(1.-u)*(1.-u)),c.z);p.x+=sin(u*9.+aTime.w*40.)*.3*u;return p;}
      vec3 v=aVel;v.xy*=mix(1.,.62,uTall);float k=aParam.x,g=aParam.y,e=1.-exp(-k*t);
      vec3 p=c+v*(e/k);p.y-=g/k*(t-e/k);return p;}
    float envelope(float t,float life){if(t<0.||t>life)return 0.;
      float start=aTime.z>2.5&&aTime.z<3.5?.3:.55;return smoothstep(0.,.025,t)*(1.-smoothstep(life*start,life,t));}
    float glitter(float t,float life){if(aTime.z<2.5)return 1.;
      float h=fract(sin(aTime.w*97.13+floor(uTime*18.)*12.9898)*43758.5453);return mix(1.,step(.42,h)*1.5,smoothstep(.5,.68,t/life));}
    // Dim, never cut, anything seen through the lettering (ray from this camera to the text plane).
    float textMask(vec3 p){vec3 d=p-cameraPosition;if(abs(d.z)<.001)return 0.;vec3 q=cameraPosition+d*((-24.-cameraPosition.z)/d.z);
      vec2 o=abs(q.xy-vec2(1.,35.))-mix(vec2(42.,21.),vec2(27.,13.5),uTall);return 1.-smoothstep(-7.,3.,max(o.x,o.y));}
    float headPx(float dist,float size){return clamp(size*uViewport.y*projectionMatrix[1][1]*.5/max(1.,dist),1.5*uPixel,6.5*uPixel);}
    vec3 heat(float t,float life){vec3 c=mix(aColor,aColor2,smoothstep(life*.4,life,t));return mix(c,vec3(1.,.96,.88),exp(-t*12.)*.7);}`;
  const common={uTime:{value:0},uPixel:{value:1},uTall:{value:0},uViewport:{value:new T.Vector2(1,1)}};
  const viewport=new T.Vector4();
  const before=(renderer:T.WebGLRenderer)=>{renderer.getCurrentViewport(viewport);common.uViewport.value.set(viewport.z,viewport.w);common.uPixel.value=renderer.getPixelRatio();};
  const attrs:[string,Float32Array,number][]=[['aOrigin',origin,3],['aTall',tall,2],['aVel',vel,3],['aTime',time,4],['aParam',param,4],['aColor',col,3],['aColor2',col2,3]];

  // Trail ribbons: one instanced strip of SEG segments per star.
  const ribbon=new T.InstancedBufferGeometry(),template:number[]=[],index:number[]=[];
  for(let j=0;j<=SEG;j++)template.push(j/SEG,-1,0,j/SEG,1,0);
  for(let j=0;j<SEG;j++){const a=j*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
  ribbon.setAttribute('position',new T.Float32BufferAttribute(template,3));ribbon.setIndex(index);
  for(const [name,array,size] of attrs)ribbon.setAttribute(name,new T.InstancedBufferAttribute(array,size));
  ribbon.instanceCount=N;
  const trails=new T.Mesh(ribbon,new T.ShaderMaterial({uniforms:common,transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    vertexShader:`${shared}varying vec3 vColor;varying float vAlpha,vSide;
      void main(){float s=position.x,side=position.y,age=uTime-aTime.x,life=aTime.y;vSide=side;
        float a=aTime.z<-.5&&aTime.z>-1.5?(age>0.&&age<life?1.-age/life*.35:0.):envelope(age,life)*glitter(age,life);
        if(aTime.z<-1.5||a<=0.||aParam.z<=0.){gl_Position=vec4(2.,2.,2.,1.);vAlpha=0.;vColor=vec3(0.);return;}
        float L=min(age,aParam.z)*(aTime.z<-.5?1.:1.-.55*age/life),t=max(0.,age-s*L),t2=max(0.,t-max(L*.1,.004));
        vec3 p=travel(t);vec4 c1=projectionMatrix*modelViewMatrix*vec4(p,1.),c2=projectionMatrix*modelViewMatrix*vec4(travel(t2),1.);
        vec2 d=(c1.xy/c1.w-c2.xy/c2.w)*uViewport;float len=length(d);d=len>1e-4?d/len:vec2(0.,1.);
        float w=headPx(c1.w,aParam.w)*.62*pow(1.-s,.7)+.65*uPixel;
        c1.xy+=vec2(-d.y,d.x)*side*w/uViewport*c1.w;gl_Position=c1;
        vAlpha=a*pow(1.-s,1.5)*(1.-.75*textMask(p))*(.8+.2*fract(aTime.w*7.3));
        vColor=mix(heat(t,life),aColor2,s*.8);}`,
    fragmentShader:`varying vec3 vColor;varying float vAlpha,vSide;void main(){float a=vAlpha*(1.-vSide*vSide);if(a<.004)discard;gl_FragColor=vec4(vColor,a);
      #include <colorspace_fragment>
    }`}));
  trails.frustumCulled=false;trails.renderOrder=6;trails.onBeforeRender=before;points.add(trails);

  const heads=new T.BufferGeometry();
  heads.setAttribute('position',new T.BufferAttribute(origin,3));for(const [name,array,size] of attrs)heads.setAttribute(name,new T.BufferAttribute(array,size));
  function material(halo:boolean){return new T.ShaderMaterial({uniforms:{...common,uHalo:{value:halo?1:0}},transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending,
    vertexShader:`${shared}uniform float uHalo;varying vec4 vColor;varying float vHot;
      void main(){float age=uTime-aTime.x,life=aTime.y,alpha=0.,boost=1.;vec3 colr=aColor;vec3 p;
        if(aTime.z<-1.5){p=centre();alpha=uHalo>.5&&age>0.&&age<life?exp(-age*16.)*.7:0.;colr=aColor;}
        else if(aTime.z<-.5){p=travel(age);alpha=age>0.&&age<life?1.:0.;colr=aColor;}
        else{p=travel(age);alpha=envelope(age,life)*glitter(age,life)*(.75+.25*fract(aTime.w*7.3));boost=1.+1.4*exp(-age*14.);colr=heat(age,life);}
        alpha*=1.-.75*textMask(p);
        vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
        float px=aTime.z<-1.5?clamp(aParam.w*uViewport.y*projectionMatrix[1][1]*.5/max(1.,-view.z),4.*uPixel,150.*uPixel):headPx(-view.z,aParam.w)*boost;
        gl_PointSize=aTime.z<-1.5?px:px*mix(1.,4.,uHalo);vColor=vec4(colr,alpha);vHot=boost-1.;
        if(alpha<=.002)gl_Position=vec4(2.,2.,2.,1.);}`,
    fragmentShader:`uniform float uHalo;varying vec4 vColor;varying float vHot;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>=1.)discard;
      vec3 c=vColor.rgb;float a;
      if(uHalo>.5){a=exp(-d*d*5.)*(1.-smoothstep(.7,1.,d))*.24*vColor.a;}
      else{a=(1.-smoothstep(.15,1.,d))*vColor.a;c=mix(c,vec3(1.,.97,.9),(1.-smoothstep(0.,.55,d))*(.2+.5*min(1.,vHot)));}
      if(a<.003)discard;gl_FragColor=vec4(c,a);
      #include <colorspace_fragment>
    }`});}
  const halo=material(true),core=material(false);
  for(const [i,mat] of [halo,core].entries()){const layer=new T.Points(heads,mat);layer.frustumCulled=false;layer.renderOrder=7+i;layer.onBeforeRender=before;points.add(layer);}
  let budget=N,haloOn=true;
  function setProgress(progress:number|null,reduced:boolean,aspect=1,limit=11500){
    points.visible=progress!==null&&!reduced;
    if(!points.visible)return;
    common.uTime.value=T.MathUtils.clamp(Number.isFinite(progress)?progress!:0,0,1)*FINALE_SECONDS;
    common.uTall.value=aspect<.85?1:0;budget=finaleBudget(limit);haloOn=finaleHalo(limit);
    heads.setDrawRange(0,budget);ribbon.instanceCount=budget;
    // Economical mode keeps trails and colour heads; medium/high add the soft halo and burst flash.
    points.children[1].visible=haloOn;
  }
  return {points,setProgress,state:()=>({visible:points.visible,time:common.uTime.value,budget,particles:N,portrait:common.uTall.value===1,halo:haloOn,shells:FINALE_SHELLS,
    draws:haloOn?3:2,trailVertices:budget*(SEG+1)*2,headPoints:budget,postprocessingBloom:false})};
}
